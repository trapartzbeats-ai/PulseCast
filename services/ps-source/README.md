# PS5 -> Twitch / Facebook with no capture card and no video re-encode

```
PS5 --(Remote Play protocol)--> psrelay.exe --(packets on stdout)--> tempo-rtmp.exe --> Twitch / Facebook
        H.264 + Opus            chiaki-ng lib, AGPL                    FLV re-frame, AAC, RTMP(S)
                                (own process, source published)         (Tempo, your own stack)
```

The PS5's own H.264 is forwarded as-is. Only the audio is converted (Opus -> PCM -> AAC).

## One-time pairing (you type the PIN and account ID, nothing is stored by anyone else)

PS5: Settings > System > Remote Play > turn on, then Link Device to show the 8-digit PIN.

```
bin\psrelay.exe register --host <PS5 IP> --account-id <base64 of 8-byte PSN account id> --pin <PIN> --out ps5.cfg
```

`ps5.cfg` holds the registration keys for your console. Keep it private.

## Go live

Put the stream URL(s) in an environment variable so the key never appears on a command line:

```
set TEMPO_RTMP_DESTS=rtmp://live.twitch.tv/app/<TWITCH KEY>
rem Facebook: rtmps://live-api-s.facebook.com:443/rtmp/<FB KEY>   (one URL per line for both)
bin\tempo-rtmp.exe --spawn bin\psrelay.exe stream --config ps5.cfg --res 1080 --fps 30 --bitrate 6000
```

- `--bitrate` (kbps) is what the PS5 encodes at, and also what goes upstream. Choose below your upload speed
  (Twitch max 6000, Facebook about 4000-6000). Lower it for weak internet; 720p at 3000 is solid.
- Closing tempo-rtmp stops psrelay. Events are JSON lines on stderr (`dest_live`, `dest_error`, `stats`).
- A dropped connection reconnects on its own and resumes at the next keyframe (within 2 s).
- If the link cannot keep up, video is dropped up to the next keyframe rather than letting delay build up.

## Building

- `psrelay`: `psrelay\build-windows.bat` (clang-cl + vcpkg at C:\Dev; machine-specific paths, see the file).
- `tempo-rtmp`: `D:\Projects\Tempo\tempo-rtmp\build_scratch.ps1` (builds from a scratch copy, the Tempo workspace root does not load).

## Tests that exist

- tempo-rtmp: `build_scratch.ps1 test` (AMF, chunking incl. extended timestamps, URL parsing, H.264 re-framing,
  AAC chunk-seam continuity).
- End to end without a PS5: `tempo-rtmp\tools\sim_psrelay.py SECONDS | tempo-rtmp.exe --dest file:out.flv`, and
  against a local ingest with `ffmpeg -listen 1 -i rtmp://127.0.0.1:19350/live/test ...` (plain RTMP and, through
  `tools\tls_proxy.py` with `TEMPO_RTMP_EXTRA_CA`, RTMPS) all pass: decodes clean, audio/video aligned.

## NOT yet tested

- psrelay against a real PS5 (pairing and streaming).
- A real Twitch / Facebook ingest (needs your stream key; the protocol path is proven against ffmpeg's RTMP server).
- H.265 (psrelay can emit it; tempo-rtmp refuses it for now, Twitch/Facebook want H.264).
- Facebook-specific quirks (stream key query string is passed through untouched).
