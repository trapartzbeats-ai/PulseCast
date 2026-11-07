// psrelay - PS5 Remote Play passthrough source for PulseCast.
//
// Links the chiaki-ng protocol library (AGPL-3.0). It runs as its OWN process so
// PulseCast itself is not combined with that licence; PulseCast only launches it
// and reads its stdout/stderr. Source for this helper is published alongside.
//
// Modes
//   psrelay register --host IP --account-id BASE64_8BYTES --pin 12345678 --out ps5.cfg
//       One-time pairing. The PIN is shown on the PS5 (Settings > System > Remote Play
//       > Link Device). Writes a key=value file with the host's registration keys.
//   psrelay stream --config ps5.cfg [--res 1080|720|540|360] [--fps 30|60]
//                  [--bitrate KBPS] [--codec h264|h265] [--idr-ms 2000]
//       Streams to stdout as framed packets. Video is the PS5's own encoded
//       H.264/H.265 (never decoded or re-encoded). Audio is the PS5's Opus frames.
//       stdin: 15-byte controller frames (see stdin_thread). Closing stdin stops the session.
//
// stdout packet frame (little endian):
//   u8  type      1 = video, 2 = audio (raw Opus, only with --raw-opus), 3 = audio header,
//                 4 = video info, 5 = audio PCM (s16le interleaved, decoded from the PS5 Opus)
//   u8  flags     video: bit0 = keyframe, bit1 = frames were lost before this one
//   u16 reserved
//   u32 length    payload bytes that follow
//   u64 ts_us     microseconds since stream start (monotonic)
// type 3 payload: u8 channels, u8 bits, u32 rate, u32 frame_size
// type 4 payload: u8 codec (0 = h264, 1 = h265), u16 width, u16 height, u16 fps
//
// stderr: one JSON object per line ({"event":...}).

#include <chiaki/common.h>
#include <chiaki/log.h>
#include <chiaki/session.h>
#include <chiaki/regist.h>
#include <chiaki/base64.h>
#include <opus/opus.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#ifdef _WIN32
#include <windows.h>
#include <io.h>
#include <fcntl.h>
#endif

static CRITICAL_SECTION g_out_lock;
static LARGE_INTEGER g_freq, g_t0;
static ChiakiSession g_session;
static volatile LONG g_stop = 0;
static unsigned g_codec = 0, g_w = 1920, g_h = 1080, g_fps = 30;
static int g_info_sent = 0;
static int g_need_key = 1;
static int g_raw_opus = 0;
static volatile LONG g_vcalls = 0, g_vkeys = 0, g_vskipped = 0;
static volatile LONG64 g_vbytes = 0;
static LARGE_INTEGER g_last_diag, g_last_adiag;
static volatile LONG g_acalls = 0, g_apeak = 0, g_adec_err = 0;
static OpusDecoder *g_opus = NULL;
static int g_chan = 2, g_frame = 480;

static uint64_t now_us(void)
{
	LARGE_INTEGER t;
	QueryPerformanceCounter(&t);
	return (uint64_t)((t.QuadPart - g_t0.QuadPart) * 1000000LL / g_freq.QuadPart);
}

static void jevent(const char *name, const char *detail)
{
	// detail must not contain quotes; callers pass fixed or sanitised text.
	fprintf(stderr, "{\"event\":\"%s\",\"detail\":\"%s\"}\n", name, detail ? detail : "");
	fflush(stderr);
}

static int write_all(const void *buf, size_t n)
{
	const uint8_t *p = (const uint8_t *)buf;
	while (n)
	{
		int w = _write(1, p, (unsigned)(n > 65536 ? 65536 : n));
		if (w <= 0)
			return -1;
		p += w;
		n -= (size_t)w;
	}
	return 0;
}

static void emit(uint8_t type, uint8_t flags, const uint8_t *payload, uint32_t len)
{
	uint8_t hdr[16];
	uint64_t ts = now_us();
	hdr[0] = type;
	hdr[1] = flags;
	hdr[2] = hdr[3] = 0;
	memcpy(hdr + 4, &len, 4);
	memcpy(hdr + 8, &ts, 8);
	EnterCriticalSection(&g_out_lock);
	if (write_all(hdr, 16) || (len && write_all(payload, len)))
		InterlockedExchange(&g_stop, 1); // consumer went away
	LeaveCriticalSection(&g_out_lock);
}

// ---- video: scan Annex-B for keyframe NALs and parameter-set NALs.
// The PS5 sends SPS/PPS as their own small sample before each IDR, so parameter
// sets must always be passed through even while we wait for the first keyframe.
#define NAL_KEY 1
#define NAL_PARAMS 2
static int nal_flags(const uint8_t *b, size_t n, int h265)
{
	int f = 0;
	for (size_t i = 0; i + 4 < n; i++)
	{
		if (b[i] == 0 && b[i + 1] == 0 && (b[i + 2] == 1 || (b[i + 2] == 0 && b[i + 3] == 1)))
		{
			size_t o = (b[i + 2] == 1) ? i + 3 : i + 4;
			if (o >= n)
				break;
			if (h265)
			{
				int t = (b[o] >> 1) & 0x3f;
				if (t >= 16 && t <= 21)
					f |= NAL_KEY;
				if (t >= 32 && t <= 34)
					f |= NAL_PARAMS;
			}
			else
			{
				int t = b[o] & 0x1f;
				if (t == 5)
					f |= NAL_KEY;
				if (t == 7 || t == 8)
					f |= NAL_PARAMS;
			}
			i = o;
		}
	}
	return f;
}

static bool video_cb(uint8_t *buf, size_t size, int32_t frames_lost, bool recovered, void *user)
{
	(void)recovered;
	(void)user;
	InterlockedIncrement(&g_vcalls);
	InterlockedAdd64(&g_vbytes, (LONG64)size);
	if (g_vcalls <= 3)
	{
		char d[160];
		int n = snprintf(d, sizeof d, "frame %ld size=%zu head=", g_vcalls, size);
		for (size_t i = 0; i < size && i < 16 && n < (int)sizeof d - 3; i++)
			n += snprintf(d + n, sizeof d - (size_t)n, "%02x", buf[i]);
		jevent("video_first_frames", d);
	}
	if (!g_info_sent)
	{
		uint8_t p[7];
		p[0] = (uint8_t)g_codec;
		uint16_t w = (uint16_t)g_w, h = (uint16_t)g_h, f = (uint16_t)g_fps;
		memcpy(p + 1, &w, 2);
		memcpy(p + 3, &h, 2);
		memcpy(p + 5, &f, 2);
		emit(4, 0, p, 7);
		g_info_sent = 1;
	}
	int nf = nal_flags(buf, size, g_codec != 0);
	int key = (nf & NAL_KEY) != 0;
	int params = (nf & NAL_PARAMS) != 0;
	if (key)
		InterlockedIncrement(&g_vkeys);
	LARGE_INTEGER t;
	QueryPerformanceCounter(&t);
	if (g_last_diag.QuadPart == 0 || (t.QuadPart - g_last_diag.QuadPart) > g_freq.QuadPart * 2)
	{
		char d[160];
		snprintf(d, sizeof d, "calls=%ld keyframes=%ld skipped_before_key=%ld bytes=%lld", g_vcalls, g_vkeys, g_vskipped, (long long)g_vbytes);
		jevent("video_diag", d);
		g_last_diag = t;
	}
	if (g_need_key && !key && !params)
	{
		InterlockedIncrement(&g_vskipped);
		return true; // do not start the downstream mid-GOP
	}
	if (key)
		g_need_key = 0;
	emit(1, (uint8_t)((key ? 1 : 0) | (frames_lost > 0 ? 2 : 0)), buf, (uint32_t)size);
	return true;
}

static void audio_header_cb(ChiakiAudioHeader *h, void *user)
{
	(void)user;
	uint8_t p[10];
	p[0] = h->channels;
	p[1] = h->bits;
	memcpy(p + 2, &h->rate, 4);
	memcpy(p + 6, &h->frame_size, 4);
	emit(3, 0, p, 10);
	g_chan = h->channels;
	g_frame = (int)h->frame_size;
	if (g_opus)
		opus_decoder_destroy(g_opus);
	int err = 0;
	g_opus = opus_decoder_create((opus_int32)h->rate, h->channels, &err);
	if (err != OPUS_OK)
	{
		g_opus = NULL;
		jevent("log_error", "opus decoder create failed");
	}
}

static void audio_frame_cb(uint8_t *buf, size_t size, void *user)
{
	(void)user;
	InterlockedIncrement(&g_acalls);
	if (g_raw_opus)
		emit(2, 0, buf, (uint32_t)size);
	if (!g_opus)
		return;
	static int16_t pcm[5760 * 2]; // up to 120 ms stereo at 48 kHz
	int n = opus_decode(g_opus, buf, (opus_int32)size, pcm, g_frame > 0 ? g_frame : 480, 0);
	if (n <= 0)
	{
		InterlockedIncrement(&g_adec_err);
	}
	else
	{
		LONG peak = g_apeak;
		for (int i = 0; i < n * g_chan; i++)
		{
			LONG v = pcm[i] < 0 ? -(LONG)pcm[i] : (LONG)pcm[i];
			if (v > peak)
				peak = v;
		}
		g_apeak = peak;
		emit(5, 0, (const uint8_t *)pcm, (uint32_t)(n * g_chan * (int)sizeof(int16_t)));
	}
	LARGE_INTEGER t;
	QueryPerformanceCounter(&t);
	if (g_last_adiag.QuadPart == 0 || (t.QuadPart - g_last_adiag.QuadPart) > g_freq.QuadPart * 2)
	{
		char d[200];
		snprintf(d, sizeof d, "frames=%ld opus_bytes=%zu decode_errors=%ld peak16=%ld chan=%d frame=%d", g_acalls, size, g_adec_err, g_apeak, g_chan, g_frame);
		jevent("audio_diag", d);
		g_apeak = 0;
		g_last_adiag = t;
	}
}

static void event_cb(ChiakiEvent *e, void *user)
{
	(void)user;
	switch (e->type)
	{
	case CHIAKI_EVENT_CONNECTED:
		jevent("connected", "");
		break;
	case CHIAKI_EVENT_LOGIN_PIN_REQUEST:
		jevent("login_pin_requested", "console wants a login PIN; not supported");
		break;
	case CHIAKI_EVENT_QUIT:
	{
		char d[128];
		snprintf(d, sizeof d, "%s", chiaki_quit_reason_string(e->quit.reason));
		for (char *c = d; *c; c++)
			if (*c == '"' || *c == '\\')
				*c = ' ';
		jevent("quit", d);
		InterlockedExchange(&g_stop, 1);
		break;
	}
	default:
		break;
	}
}

static void log_cb(ChiakiLogLevel level, const char *msg, void *user)
{
	(void)user;
	if (level == CHIAKI_LOG_ERROR || level == CHIAKI_LOG_WARNING)
	{
		char d[256];
		size_t k = 0;
		for (; msg[k] && k < sizeof d - 1; k++)
			d[k] = (msg[k] == '"' || msg[k] == '\\' || msg[k] == '\n' || msg[k] == '\r') ? ' ' : msg[k];
		d[k] = 0;
		jevent(level == CHIAKI_LOG_ERROR ? "log_error" : "log_warn", d);
	}
}

static DWORD WINAPI idr_thread(LPVOID arg)
{
	DWORD ms = (DWORD)(uintptr_t)arg;
	while (!g_stop)
	{
		Sleep(ms);
		if (!g_stop)
			chiaki_session_request_idr(&g_session);
	}
	return 0;
}

static DWORD WINAPI stdin_thread(LPVOID arg)
{
	// stdin carries 15-byte controller frames: 0xC7, u32 buttons, u8 l2, u8 r2, i16 lx, ly, rx, ry (LE).
	(void)arg;
	uint8_t b[256];
	int have = 0;
	for (;;)
	{
		int n = _read(0, b + have, (unsigned)(sizeof b - have));
		if (n <= 0)
			break;
		have += n;
		while (have >= 15)
		{
			if (b[0] != 0xC7)
			{
				memmove(b, b + 1, --have);
				continue;
			}
			ChiakiControllerState st;
			chiaki_controller_state_set_idle(&st);
			st.buttons = (uint32_t)b[1] | ((uint32_t)b[2] << 8) | ((uint32_t)b[3] << 16) | ((uint32_t)b[4] << 24);
			st.l2_state = b[5];
			st.r2_state = b[6];
			st.left_x = (int16_t)(b[7] | (b[8] << 8));
			st.left_y = (int16_t)(b[9] | (b[10] << 8));
			st.right_x = (int16_t)(b[11] | (b[12] << 8));
			st.right_y = (int16_t)(b[13] | (b[14] << 8));
			chiaki_session_set_controller_state(&g_session, &st);
			have -= 15;
			memmove(b, b + 15, have);
		}
	}
	InterlockedExchange(&g_stop, 1); // stdin closed => stop
	return 0;
}

// ---- tiny key=value config
static void hex_encode(const uint8_t *in, size_t n, char *out)
{
	for (size_t i = 0; i < n; i++)
		sprintf(out + i * 2, "%02x", in[i]);
}

static int hex_decode(const char *s, uint8_t *out, size_t n)
{
	if (strlen(s) < n * 2)
		return -1;
	for (size_t i = 0; i < n; i++)
	{
		unsigned v;
		if (sscanf(s + i * 2, "%2x", &v) != 1)
			return -1;
		out[i] = (uint8_t)v;
	}
	return 0;
}

static const char *argval(int argc, char **argv, const char *key, const char *def)
{
	for (int i = 2; i + 1 < argc; i++)
		if (!strcmp(argv[i], key))
			return argv[i + 1];
	return def;
}

static volatile int g_regist_done = 0;
static ChiakiRegisteredHost g_reg;
static int g_regist_ok = 0;

static void regist_cb(ChiakiRegistEvent *e, void *user)
{
	(void)user;
	if (e->type == CHIAKI_REGIST_EVENT_TYPE_FINISHED_SUCCESS)
	{
		g_reg = *e->registered_host;
		g_regist_ok = 1;
	}
	g_regist_done = 1;
}

static int do_register(int argc, char **argv)
{
	const char *host = argval(argc, argv, "--host", NULL);
	const char *acct = argval(argc, argv, "--account-id", NULL);
	const char *pin = argval(argc, argv, "--pin", NULL);
	const char *out = argval(argc, argv, "--out", "ps5.cfg");
	if (!host || !acct || !pin)
	{
		fprintf(stderr, "usage: psrelay register --host IP --account-id B64 --pin N [--out FILE]\n");
		return 2;
	}
	ChiakiRegistInfo info;
	memset(&info, 0, sizeof info);
	info.target = CHIAKI_TARGET_PS5_1;
	info.host = host;
	info.broadcast = false;
	info.pin = (uint32_t)strtoul(pin, NULL, 10);
	size_t sz = CHIAKI_PSN_ACCOUNT_ID_SIZE;
	if (chiaki_base64_decode(acct, strlen(acct), info.psn_account_id, &sz) != CHIAKI_ERR_SUCCESS || sz != CHIAKI_PSN_ACCOUNT_ID_SIZE)
	{
		fprintf(stderr, "account-id must be base64 of exactly 8 bytes\n");
		return 2;
	}
	ChiakiLog log;
	chiaki_log_init(&log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE, log_cb, NULL);
	ChiakiRegist regist;
	if (chiaki_regist_start(&regist, &log, &info, regist_cb, NULL) != CHIAKI_ERR_SUCCESS)
	{
		jevent("register_failed", "could not start");
		return 1;
	}
	while (!g_regist_done)
		Sleep(100);
	chiaki_regist_fini(&regist);
	if (!g_regist_ok)
	{
		jevent("register_failed", "console refused (wrong PIN or Remote Play off)");
		return 1;
	}
	char rk[0x10 * 2 + 1], morning[0x10 * 2 + 1];
	// regist_key text is the ASCII key padded; store hex of the raw 16 bytes
	hex_encode((const uint8_t *)g_reg.rp_regist_key, 0x10, rk);
	hex_encode(g_reg.rp_key, 0x10, morning);
	FILE *f = fopen(out, "w");
	if (!f)
	{
		jevent("register_failed", "cannot write config");
		return 1;
	}
	fprintf(f, "host=%s\nregist_key=%s\nmorning=%s\n", host, rk, morning);
	fclose(f);
	jevent("registered", "config written");
	return 0;
}

static int do_stream(int argc, char **argv)
{
	const char *cfg = argval(argc, argv, "--config", "ps5.cfg");
	char host[128] = "", rk[64] = "", mo[64] = "";
	FILE *f = fopen(cfg, "r");
	if (!f)
	{
		jevent("error", "cannot read config; run register first");
		return 2;
	}
	char line[256];
	while (fgets(line, sizeof line, f))
	{
		line[strcspn(line, "\r\n")] = 0;
		if (!strncmp(line, "host=", 5))
			snprintf(host, sizeof host, "%s", line + 5);
		else if (!strncmp(line, "regist_key=", 11))
			snprintf(rk, sizeof rk, "%s", line + 11);
		else if (!strncmp(line, "morning=", 8))
			snprintf(mo, sizeof mo, "%s", line + 8);
	}
	fclose(f);

	int res = atoi(argval(argc, argv, "--res", "1080"));
	int fps = atoi(argval(argc, argv, "--fps", "30"));
	int kbps = atoi(argval(argc, argv, "--bitrate", "6000"));
	int idr_ms = atoi(argval(argc, argv, "--idr-ms", "2000"));
	const char *codec = argval(argc, argv, "--codec", "h264");
	g_raw_opus = !strcmp(argval(argc, argv, "--raw-opus", "0"), "1");

	ChiakiConnectInfo ci;
	memset(&ci, 0, sizeof ci);
	ci.ps5 = true;
	ci.host = host;
	if (hex_decode(rk, (uint8_t *)ci.regist_key, 0x10) || hex_decode(mo, ci.morning, 0x10))
	{
		jevent("error", "bad keys in config");
		return 2;
	}
	ChiakiVideoResolutionPreset rp = res >= 1080 ? CHIAKI_VIDEO_RESOLUTION_PRESET_1080p
	                                 : res >= 720 ? CHIAKI_VIDEO_RESOLUTION_PRESET_720p
	                                 : res >= 540 ? CHIAKI_VIDEO_RESOLUTION_PRESET_540p
	                                              : CHIAKI_VIDEO_RESOLUTION_PRESET_360p;
	chiaki_connect_video_profile_preset(&ci.video_profile, rp, fps >= 60 ? CHIAKI_VIDEO_FPS_PRESET_60 : CHIAKI_VIDEO_FPS_PRESET_30);
	ci.video_profile.bitrate = (unsigned)kbps; // preset's default bitrate overridden: this is the cap that fits the uplink
	ci.video_profile.codec = !strcmp(codec, "h265") ? CHIAKI_CODEC_H265 : CHIAKI_CODEC_H264;
	ci.video_profile_auto_downgrade = true;
	ci.packet_loss_max = 0.05;
	ci.enable_idr_on_fec_failure = true;
	g_codec = ci.video_profile.codec == CHIAKI_CODEC_H265 ? 1 : 0;
	g_w = ci.video_profile.width;
	g_h = ci.video_profile.height;
	g_fps = ci.video_profile.max_fps;

	ChiakiLog log;
	chiaki_log_init(&log, CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE & ~CHIAKI_LOG_DEBUG, log_cb, NULL);
	if (chiaki_session_init(&g_session, &ci, &log) != CHIAKI_ERR_SUCCESS)
	{
		jevent("error", "session init failed");
		return 1;
	}
	chiaki_session_set_event_cb(&g_session, event_cb, NULL);
	chiaki_session_set_video_sample_cb(&g_session, video_cb, NULL);
	ChiakiAudioSink sink = {0};
	sink.header_cb = audio_header_cb;
	sink.frame_cb = audio_frame_cb;
	chiaki_session_set_audio_sink(&g_session, &sink);

	QueryPerformanceFrequency(&g_freq);
	QueryPerformanceCounter(&g_t0);
	CreateThread(NULL, 0, stdin_thread, NULL, 0, NULL);
	if (chiaki_session_start(&g_session) != CHIAKI_ERR_SUCCESS)
	{
		jevent("error", "session start failed");
		chiaki_session_fini(&g_session);
		return 1;
	}
	CreateThread(NULL, 0, idr_thread, (LPVOID)(uintptr_t)idr_ms, 0, NULL);
	while (!g_stop)
		Sleep(100);
	chiaki_session_stop(&g_session);
	chiaki_session_join(&g_session);
	chiaki_session_fini(&g_session);
	jevent("stopped", "");
	return 0;
}

int main(int argc, char **argv)
{
	_setmode(0, _O_BINARY);
	_setmode(1, _O_BINARY);
	InitializeCriticalSection(&g_out_lock);
	if (chiaki_lib_init() != CHIAKI_ERR_SUCCESS)
	{
		jevent("error", "chiaki_lib_init failed");
		return 1;
	}
	if (argc >= 2 && !strcmp(argv[1], "register"))
		return do_register(argc, argv);
	if (argc >= 2 && !strcmp(argv[1], "stream"))
		return do_stream(argc, argv);
	fprintf(stderr, "usage: psrelay register|stream ...\n");
	return 2;
}
