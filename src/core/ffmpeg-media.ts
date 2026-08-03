import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MediaProofType = "real" | "unavailable";
export type MediaDeviceKind = "video" | "audio";
export type MediaPlatform = "twitch" | "facebook";
export type StreamLifecycle =
  "idle" | "starting" | "live" | "reconnecting" | "stopping" | "stopped" | "failed";

export interface MediaDevice {
  kind: MediaDeviceKind;
  name: string;
  alternativeName: string | null;
}

export interface EncoderProbe {
  name: "h264_nvenc" | "h264_qsv" | "h264_amf" | "libx264";
  available: boolean;
  hardware: boolean;
}

export interface MediaBackendProbe {
  proofType: MediaProofType;
  adapter: "FfmpegDirectShowAdapter/v1";
  ffmpegPath: string | null;
  ffmpegVersion: string | null;
  devices: MediaDevice[];
  encoders: EncoderProbe[];
  rtmpsSupported: boolean;
  detail: string;
}

export interface CaptureSelection {
  videoDevice: string;
  audioDevice: string;
}

export interface EncodingSettings {
  width?: 1280 | 1920;
  height?: 720 | 1080;
  fps?: 30 | 60;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  encoder?: EncoderProbe["name"] | "auto";
}

export interface CameraMicProofRequest extends CaptureSelection, EncodingSettings {
  outputDirectory: string;
  durationMs?: number;
}

export interface CameraMicProofResult {
  proofType: "real";
  adapter: "FfmpegDirectShowAdapter/v1";
  success: boolean;
  outputPath: string;
  logPath: string;
  fileSizeBytes: number;
  sha256: string | null;
  encoder: EncoderProbe["name"];
  video: {
    codec: string | null;
    width: number | null;
    height: number | null;
  };
  audio: {
    codec: string | null;
    sampleRate: number | null;
    channels: number | null;
    signalDetected: boolean;
    rmsLevelDb: number | null;
    peakLevelDb: number | null;
  };
  durationSeconds: number | null;
  errorMessage: string;
}

export interface StreamDestinationRequest {
  id: string;
  platform: MediaPlatform;
  streamKey: string;
  /**
   * Optional advanced override. It must be an RTMPS base URL without the key,
   * credentials, query string, or fragment.
   */
  ingestBaseUrl?: string;
  /**
   * Twitch only. Adds the official bandwidth-test query without making the
   * channel viewer-visible.
   */
  bandwidthTest?: boolean;
}

export interface StartStreamRequest extends CaptureSelection, EncodingSettings {
  destinations: StreamDestinationRequest[];
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelayMs?: number;
    maximumDelayMs?: number;
  };
}

export interface DestinationHealth {
  id: string;
  platform: MediaPlatform;
  state: "connecting" | "live" | "degraded" | "stopped";
  detail: string;
}

export interface StreamHealth {
  proofType: "real";
  adapter: "FfmpegDirectShowAdapter/v1";
  sessionId: string | null;
  lifecycle: StreamLifecycle;
  pid: number | null;
  startedAt: string | null;
  reconnectAttempt: number;
  frame: number;
  outputTimeMs: number;
  speed: string;
  audioLevelDb: number | null;
  destinations: DestinationHealth[];
  lastError: string;
  /**
   * This immediate FFmpeg proof path never writes or logs keys. FFmpeg still
   * receives destination URLs in its child-process command line.
   */
  credentialBoundary: "runtime-memory-and-child-command-line";
}

export interface MediaEngineEvent {
  type: "state" | "progress" | "destination" | "log";
  at: string;
  health: StreamHealth;
  message: string;
}

export interface FfmpegMediaEngineOptions {
  ffmpegPath?: string;
  logDirectory?: string;
  onEvent?: (event: MediaEngineEvent) => void;
}

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface FfprobeOutput {
  streams?: Array<{
    codec_name?: string;
    codec_type?: "video" | "audio";
    width?: number;
    height?: number;
    sample_rate?: string;
    channels?: number;
  }>;
  format?: { duration?: string; size?: string };
}

const defaultIngest: Record<MediaPlatform, string> = {
  twitch: "rtmps://live.twitch.tv:443/app",
  facebook: "rtmps://live-api-s.facebook.com:443/rtmp",
};

const encoderOrder: EncoderProbe["name"][] = ["h264_nvenc", "h264_qsv", "h264_amf", "libx264"];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseDirectShowDevices(stderr: string): MediaDevice[] {
  const result: MediaDevice[] = [];
  const lines = stderr.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/"([^"]+)"\s+\((video|audio)\)\s*$/i);
    if (!match) continue;
    const alternative = lines[index + 1]?.match(/Alternative name\s+"([^"]+)"\s*$/i)?.[1] ?? null;
    result.push({
      name: match[1],
      kind: match[2].toLowerCase() as MediaDeviceKind,
      alternativeName: alternative,
    });
  }
  return result.filter(
    (device, index) =>
      result.findIndex(
        (candidate) => candidate.kind === device.kind && candidate.name === device.name,
      ) === index,
  );
}

export function redactMediaLog(value: string, secrets: readonly string[]): string {
  let redacted = value;
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted
    .replace(/(rtmps?:\/\/[^/\s]+\/(?:app|rtmp)\/)[^\s"'|]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:key|token|access_token)=)[^&\s]+/gi, "$1[REDACTED]");
}

function sanitizeError(value: unknown, secrets: readonly string[] = []): string {
  const message = value instanceof Error ? value.message : String(value);
  return redactMediaLog(message, secrets).slice(0, 1000);
}

async function resolveExecutable(explicitPath?: string): Promise<string | null> {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    resourcesPath ? path.join(resourcesPath, "media", "ffmpeg.exe") : undefined,
    explicitPath,
    process.env.PULSECAST_FFMPEG_PATH,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (await fileExists(resolved)) return resolved;
  }

  try {
    const result = await execFileAsync("where.exe", ["ffmpeg.exe"], {
      windowsHide: true,
      timeout: 5_000,
    });
    for (const candidate of splitLines(result.stdout)) {
      if (await fileExists(candidate)) return path.resolve(candidate);
    }
  } catch {
    // The adapter reports unavailable below.
  }
  return null;
}

async function runProcess(
  executable: string,
  args: string[],
  timeoutMs: number,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = (stdout + chunk.toString("utf8")).slice(-2_000_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-2_000_000);
    });
    child.on("error", (error) => {
      stderr += `\n${error.message}`;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr, timedOut });
    });
  });
}

async function probeEncoder(executable: string, name: EncoderProbe["name"]): Promise<EncoderProbe> {
  const result = await runProcess(
    executable,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=30",
      "-frames:v",
      "3",
      "-c:v",
      name,
      "-f",
      "null",
      "NUL",
    ],
    12_000,
  );
  return {
    name,
    hardware: name !== "libx264",
    available: result.exitCode === 0,
  };
}

export async function probeFfmpegMediaBackend(explicitPath?: string): Promise<MediaBackendProbe> {
  const executable = await resolveExecutable(explicitPath);
  if (!executable) {
    return {
      proofType: "unavailable",
      adapter: "FfmpegDirectShowAdapter/v1",
      ffmpegPath: null,
      ffmpegVersion: null,
      devices: [],
      encoders: encoderOrder.map((name) => ({
        name,
        hardware: name !== "libx264",
        available: false,
      })),
      rtmpsSupported: false,
      detail:
        "FFmpeg was not found. Set PULSECAST_FFMPEG_PATH or package resources/media/ffmpeg.exe.",
    };
  }

  const [versionResult, deviceResult, protocolResult, ...encoders] = await Promise.all([
    runProcess(executable, ["-hide_banner", "-version"], 8_000),
    runProcess(
      executable,
      ["-hide_banner", "-f", "dshow", "-list_devices", "true", "-i", "dummy"],
      12_000,
    ),
    runProcess(executable, ["-hide_banner", "-protocols"], 8_000),
    ...encoderOrder.map((name) => probeEncoder(executable, name)),
  ]);

  const version = splitLines(versionResult.stdout || versionResult.stderr)[0] ?? null;
  const devices = parseDirectShowDevices(deviceResult.stderr);
  const rtmpsSupported = /(^|\s)rtmps(\s|$)/m.test(
    `${protocolResult.stdout}\n${protocolResult.stderr}`,
  );

  return {
    proofType: "real",
    adapter: "FfmpegDirectShowAdapter/v1",
    ffmpegPath: executable,
    ffmpegVersion: version,
    devices,
    encoders: encoders as EncoderProbe[],
    rtmpsSupported,
    detail:
      devices.some((device) => device.kind === "video") &&
      devices.some((device) => device.kind === "audio") &&
      rtmpsSupported
        ? "Real DirectShow camera/audio capture and RTMPS transport are available."
        : "FFmpeg is real, but one or more camera, audio, or RTMPS requirements are unavailable.",
  };
}

export function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(value as number)));
}

function captureArgs(selection: CaptureSelection, settings: EncodingSettings): string[] {
  if (!selection.videoDevice.trim() || !selection.audioDevice.trim()) {
    throw new Error("A camera and microphone must both be selected.");
  }
  if (/[\r\n]/.test(`${selection.videoDevice}${selection.audioDevice}`)) {
    throw new Error("Device names cannot contain line breaks.");
  }
  const width = settings.width === 1920 ? 1920 : 1280;
  const height = settings.height === 1080 ? 1080 : 720;
  const fps = settings.fps === 60 ? 60 : 30;
  return [
    "-thread_queue_size",
    "1024",
    "-f",
    "dshow",
    "-rtbufsize",
    "512M",
    "-use_wallclock_as_timestamps",
    "1",
    "-video_size",
    `${width}x${height}`,
    "-framerate",
    String(fps),
    "-vcodec",
    "mjpeg",
    "-i",
    `video=${selection.videoDevice}:audio=${selection.audioDevice}`,
  ];
}

function encodingArgs(encoder: EncoderProbe["name"], settings: EncodingSettings): string[] {
  const fps = settings.fps === 60 ? 60 : 30;
  const videoBitrate = clampInteger(settings.videoBitrateKbps, 4_500, 500, 12_000);
  const audioBitrate = clampInteger(settings.audioBitrateKbps, 160, 64, 320);
  const common = [
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    encoder,
    "-g",
    String(fps * 2),
    "-keyint_min",
    String(fps * 2),
    "-sc_threshold",
    "0",
    "-b:v",
    `${videoBitrate}k`,
    "-maxrate",
    `${videoBitrate}k`,
    "-bufsize",
    `${videoBitrate * 2}k`,
  ];
  if (encoder === "h264_nvenc") {
    common.push("-preset", "p4", "-tune", "ll", "-rc", "cbr", "-bf", "0");
  } else if (encoder === "h264_qsv") {
    common.push("-preset", "veryfast", "-look_ahead", "0", "-bf", "0");
  } else if (encoder === "h264_amf") {
    common.push("-quality", "speed", "-rc", "cbr", "-bf", "0");
  } else {
    common.push("-preset", "veryfast", "-tune", "zerolatency", "-bf", "0");
  }
  common.push("-c:a", "aac", "-b:a", `${audioBitrate}k`, "-ar", "48000", "-ac", "2");
  return common;
}

export function chooseEncoder(
  request: EncodingSettings["encoder"],
  encoders: EncoderProbe[],
): EncoderProbe["name"] {
  if (request && request !== "auto") {
    if (!encoders.some((encoder) => encoder.name === request && encoder.available)) {
      throw new Error(`Requested encoder ${request} is unavailable.`);
    }
    return request;
  }
  return (
    encoderOrder.find((name) =>
      encoders.some((encoder) => encoder.name === name && encoder.available),
    ) ?? "libx264"
  );
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function inspectMedia(ffmpegPath: string, outputPath: string): Promise<FfprobeOutput | null> {
  const ffprobePath = path.join(path.dirname(ffmpegPath), "ffprobe.exe");
  const executable = (await fileExists(ffprobePath)) ? ffprobePath : "ffprobe";
  const result = await runProcess(
    executable,
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,codec_type,width,height,sample_rate,channels:format=duration,size",
      "-of",
      "json",
      outputPath,
    ],
    15_000,
  );
  if (result.exitCode !== 0) return null;
  try {
    return JSON.parse(result.stdout) as FfprobeOutput;
  } catch {
    return null;
  }
}

export function verifySelectedDevices(devices: MediaDevice[], selection: CaptureSelection): void {
  const videoExists = devices.some(
    (device) => device.kind === "video" && device.name === selection.videoDevice,
  );
  const audioExists = devices.some(
    (device) => device.kind === "audio" && device.name === selection.audioDevice,
  );
  if (!videoExists || !audioExists) {
    throw new Error(
      "The selected camera or microphone is not present in the latest DirectShow inventory.",
    );
  }
}

export async function recordCameraMicProof(
  request: CameraMicProofRequest,
  explicitFfmpegPath?: string,
): Promise<CameraMicProofResult> {
  const probe = await probeFfmpegMediaBackend(explicitFfmpegPath);
  if (probe.proofType === "unavailable" || !probe.ffmpegPath) {
    throw new Error(probe.detail);
  }
  verifySelectedDevices(probe.devices, request);
  const encoder = chooseEncoder(request.encoder, probe.encoders);
  const durationMs = clampInteger(request.durationMs, 5_000, 1_000, 30_000);
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  await mkdir(request.outputDirectory, { recursive: true });
  const outputPath = path.join(request.outputDirectory, `camera-mic-${id}.mp4`);
  const logPath = path.join(request.outputDirectory, `camera-mic-${id}.log`);
  const args = [
    "-hide_banner",
    "-y",
    ...captureArgs(request, request),
    "-t",
    (durationMs / 1000).toFixed(3),
    "-vf",
    `fps=${request.fps === 60 ? 60 : 30},setpts=PTS-STARTPTS,scale=${
      request.width === 1920 ? 1920 : 1280
    }:${request.height === 1080 ? 1080 : 720}:force_original_aspect_ratio=decrease,pad=${
      request.width === 1920 ? 1920 : 1280
    }:${request.height === 1080 ? 1080 : 720}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    "-af",
    "aresample=async=1:first_pts=0,astats=metadata=1:reset=1",
    ...encodingArgs(encoder, request),
    "-movflags",
    "+faststart",
    outputPath,
  ];
  const result = await runProcess(probe.ffmpegPath, args, durationMs + 25_000);
  await writeFile(logPath, redactMediaLog(result.stderr, []), { encoding: "utf8", mode: 0o600 });

  const exists = await fileExists(outputPath);
  const inspection = exists ? await inspectMedia(probe.ffmpegPath, outputPath) : null;
  const video = inspection?.streams?.find((stream) => stream.codec_type === "video");
  const audio = inspection?.streams?.find((stream) => stream.codec_type === "audio");
  const fileStat = exists ? await stat(outputPath) : null;
  const rmsMatches = [...result.stderr.matchAll(/RMS level dB:\s*(-?(?:\d+(?:\.\d+)?|inf))/gi)];
  const peakMatches = [...result.stderr.matchAll(/Peak level dB:\s*(-?(?:\d+(?:\.\d+)?|inf))/gi)];
  const rmsLevelDb = rmsMatches.length
    ? Number.parseFloat(rmsMatches[rmsMatches.length - 1][1])
    : null;
  const peakLevelDb = peakMatches.length
    ? Number.parseFloat(peakMatches[peakMatches.length - 1][1])
    : null;
  const success =
    result.exitCode === 0 &&
    Boolean(video?.codec_name) &&
    Boolean(audio?.codec_name) &&
    (fileStat?.size ?? 0) > 0;

  return {
    proofType: "real",
    adapter: "FfmpegDirectShowAdapter/v1",
    success,
    outputPath,
    logPath,
    fileSizeBytes: fileStat?.size ?? 0,
    sha256: success ? await sha256(outputPath) : null,
    encoder,
    video: {
      codec: video?.codec_name ?? null,
      width: video?.width ?? null,
      height: video?.height ?? null,
    },
    audio: {
      codec: audio?.codec_name ?? null,
      sampleRate: audio?.sample_rate ? Number.parseInt(audio.sample_rate, 10) : null,
      channels: audio?.channels ?? null,
      signalDetected:
        (Number.isFinite(rmsLevelDb) && (rmsLevelDb as number) > -90) ||
        (Number.isFinite(peakLevelDb) && (peakLevelDb as number) > -90),
      rmsLevelDb: Number.isFinite(rmsLevelDb) ? rmsLevelDb : null,
      peakLevelDb: Number.isFinite(peakLevelDb) ? peakLevelDb : null,
    },
    durationSeconds: inspection?.format?.duration
      ? Number.parseFloat(inspection.format.duration)
      : null,
    errorMessage: success
      ? ""
      : result.timedOut
        ? "Camera/microphone proof timed out."
        : redactMediaLog(splitLines(result.stderr).slice(-4).join(" "), []),
  };
}

export function destinationUrl(destination: StreamDestinationRequest): string {
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(destination.streamKey)) {
    throw new Error(`The ${destination.platform} stream key has an unsupported format.`);
  }
  const base = destination.ingestBaseUrl ?? defaultIngest[destination.platform];
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`The ${destination.platform} ingest URL is invalid.`);
  }
  if (
    parsed.protocol !== "rtmps:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `The ${destination.platform} ingest URL must be a credential-free RTMPS base URL.`,
    );
  }
  if (/[|[\]\r\n]/.test(base)) {
    throw new Error(`The ${destination.platform} ingest URL is unsupported.`);
  }
  const bandwidthTest =
    destination.platform === "twitch" && destination.bandwidthTest ? "?bandwidthtest=true" : "";
  return `${base.replace(/\/+$/, "")}/${destination.streamKey}${bandwidthTest}`;
}

export function teeOutput(destinations: StreamDestinationRequest[]): string {
  return destinations
    .map((destination) => {
      const url = destinationUrl(destination);
      return `[f=flv:onfail=ignore:use_fifo=1]${url}`;
    })
    .join("|");
}

function initialHealth(): StreamHealth {
  return {
    proofType: "real",
    adapter: "FfmpegDirectShowAdapter/v1",
    sessionId: null,
    lifecycle: "idle",
    pid: null,
    startedAt: null,
    reconnectAttempt: 0,
    frame: 0,
    outputTimeMs: 0,
    speed: "0x",
    audioLevelDb: null,
    destinations: [],
    lastError: "",
    credentialBoundary: "runtime-memory-and-child-command-line",
  };
}

export class FfmpegMediaEngine {
  private readonly options: FfmpegMediaEngineOptions;
  private child: ChildProcessWithoutNullStreams | null = null;
  private health: StreamHealth = initialHealth();
  private activeRequest: StartStreamRequest | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private expectedStop = false;
  private logLines: string[] = [];
  private lineBuffers = { stdout: "", stderr: "" };

  constructor(options: FfmpegMediaEngineOptions = {}) {
    this.options = options;
  }

  getHealth(): StreamHealth {
    return structuredClone(this.health);
  }

  async probe(): Promise<MediaBackendProbe> {
    return probeFfmpegMediaBackend(this.options.ffmpegPath);
  }

  async start(request: StartStreamRequest): Promise<StreamHealth> {
    if (this.child || this.reconnectTimer) {
      throw new Error("A media stream is already active.");
    }
    /**
     * Production-endpoint safety gate.
     *
     * - Twitch: default RTMPS goes to live.twitch.tv.  The engine requires
     *   `bandwidthTest: true` (sends real packets without appearing live) OR
     *   an explicit override via the `PULSECAST_TWITCH_LIVE=1` env var.
     * - Facebook: there is no bandwidth-test mode.  The engine requires the
     *   `PULSECAST_FACEBOOK_LIVE=1` env var AND a non-default ingest URL.
     * - Custom ingest URLs (e.g. rtmp-push.dev or a local test endpoint)
     *   bypass this gate entirely.
     */
    const productionHosts: Record<MediaPlatform, string> = {
      twitch: "live.twitch.tv",
      facebook: "live-api-s.facebook.com",
    };
    for (const dest of request.destinations) {
      const base = dest.ingestBaseUrl ?? defaultIngest[dest.platform];
      const isProduction = base.toLowerCase().includes(productionHosts[dest.platform]);
      if (!isProduction) continue;

      if (dest.platform === "twitch") {
        const isBandwidthTest = dest.bandwidthTest === true;
        const hasOverride = process.env.PULSECAST_TWITCH_LIVE === "1";
        if (isBandwidthTest || hasOverride) continue;
        throw new Error(
          "Twitch production endpoint blocked by safety gate. " +
            "Set ?bandwidthtest=true for a non-viewer-visible test, " +
            "or set PULSECAST_TWITCH_LIVE=1 for explicit live override.",
        );
      }

      if (dest.platform === "facebook") {
        const hasOverride = process.env.PULSECAST_FACEBOOK_LIVE === "1";
        if (hasOverride && dest.ingestBaseUrl && dest.ingestBaseUrl !== defaultIngest.facebook) {
          continue;
        }
        throw new Error(
          "Facebook production endpoint blocked by safety gate. " +
            "Set PULSECAST_FACEBOOK_LIVE=1 and provide the specific Server URL " +
            "from Facebook Live Producer.",
        );
      }
    }

    if (request.destinations.length < 1 || request.destinations.length > 2) {
      throw new Error("Select one or two destinations.");
    }
    if (
      new Set(request.destinations.map((destination) => destination.id)).size !==
      request.destinations.length
    ) {
      throw new Error("Destination IDs must be unique.");
    }
    const probe = await this.probe();
    if (probe.proofType === "unavailable" || !probe.ffmpegPath) {
      throw new Error(probe.detail);
    }
    if (!probe.rtmpsSupported) {
      throw new Error("This FFmpeg build does not support RTMPS.");
    }
    verifySelectedDevices(probe.devices, request);
    const encoder = chooseEncoder(request.encoder, probe.encoders);
    // Validate all destination inputs before retaining the request in memory.
    teeOutput(request.destinations);

    this.activeRequest = structuredClone(request);
    this.expectedStop = false;
    this.health = {
      ...initialHealth(),
      sessionId: randomUUID(),
      lifecycle: "starting",
      startedAt: new Date().toISOString(),
      destinations: request.destinations.map((destination) => ({
        id: destination.id,
        platform: destination.platform,
        state: "connecting",
        detail: "Connecting over RTMPS.",
      })),
    };
    this.emit("state", `Starting ${request.destinations.length} RTMPS destination(s).`);
    await this.launch(probe.ffmpegPath, encoder);
    return this.getHealth();
  }

  async stop(): Promise<StreamHealth> {
    this.expectedStop = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.child) {
      this.activeRequest = null;
      this.health.lifecycle = "stopped";
      this.health.destinations = this.health.destinations.map((destination) => ({
        ...destination,
        state: "stopped",
        detail: "Stopped.",
      }));
      return this.getHealth();
    }

    this.health.lifecycle = "stopping";
    this.emit("state", "Stopping FFmpeg cleanly.");
    const child = this.child;
    child.stdin.write("q\n");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 5_000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.child = null;
    this.activeRequest = null;
    this.health.pid = null;
    this.health.lifecycle = "stopped";
    this.health.destinations = this.health.destinations.map((destination) => ({
      ...destination,
      state: "stopped",
      detail: "Stopped.",
    }));
    this.emit("state", "Stream stopped.");
    return this.getHealth();
  }

  private async launch(executable: string, encoder: EncoderProbe["name"]): Promise<void> {
    const request = this.activeRequest;
    if (!request) throw new Error("No active stream request.");
    const secrets = request.destinations.map((destination) => destination.streamKey);
    const args = [
      "-hide_banner",
      "-nostats",
      "-loglevel",
      "info",
      "-progress",
      "pipe:1",
      ...captureArgs(request, request),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-vf",
      `fps=${request.fps === 60 ? 60 : 30},setpts=PTS-STARTPTS,format=yuv420p`,
      "-af",
      "aresample=async=1:first_pts=0,ebur128=metadata=1:peak=true",
      ...encodingArgs(encoder, request),
      "-flvflags",
      "no_duration_filesize",
      "-f",
      "tee",
      teeOutput(request.destinations),
    ];

    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.health.pid = child.pid ?? null;
    this.lineBuffers = { stdout: "", stderr: "" };
    this.logLines = [];

    child.stdout.on("data", (chunk: Buffer) => {
      this.consumeProgress(chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.consumeStderr(chunk.toString("utf8"), secrets);
    });
    child.on("error", (error) => {
      this.health.lastError = sanitizeError(error, secrets);
      this.emit("log", this.health.lastError);
    });
    child.on("close", (code) => {
      void this.handleExit(code ?? -1, secrets);
    });
  }

  private consumeProgress(chunk: string): void {
    this.lineBuffers.stdout += chunk;
    const lines = this.lineBuffers.stdout.split(/\r?\n/);
    this.lineBuffers.stdout = lines.pop() ?? "";
    for (const line of lines) {
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (key === "frame") this.health.frame = Number.parseInt(value, 10) || 0;
      if (key === "out_time_ms") {
        this.health.outputTimeMs = Math.round((Number.parseInt(value, 10) || 0) / 1000);
      }
      if (key === "speed") this.health.speed = value;
      if (key === "progress" && value === "continue") {
        if (this.health.lifecycle !== "live") {
          this.health.lifecycle = "live";
          this.health.destinations = this.health.destinations.map((destination) =>
            destination.state === "connecting"
              ? { ...destination, state: "live", detail: "Publishing over RTMPS." }
              : destination,
          );
          this.emit("state", "FFmpeg is publishing media.");
        } else {
          this.emit("progress", "Stream progress updated.");
        }
      }
    }
  }

  private consumeStderr(chunk: string, secrets: readonly string[]): void {
    this.lineBuffers.stderr += chunk;
    const lines = this.lineBuffers.stderr.split(/\r?\n/);
    this.lineBuffers.stderr = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = redactMediaLog(rawLine, secrets).trim();
      if (!line) continue;
      this.logLines.push(line);
      if (this.logLines.length > 500) this.logLines.shift();
      const slaveFailure = rawLine.match(/Slave muxer #(\d+) failed/i);
      if (slaveFailure) {
        const index = Number.parseInt(slaveFailure[1], 10);
        const destination = this.health.destinations[index];
        if (destination) {
          destination.state = "degraded";
          destination.detail = "FFmpeg reported an output failure; FIFO recovery is active.";
          this.emit("destination", `${destination.platform} output is recovering.`);
        }
      }
      if (/\b(error|failed|refused|timed out)\b/i.test(line)) {
        this.health.lastError = line.slice(0, 1000);
      }
      const audioLevel = rawLine.match(/\bM:\s*(-?\d+(?:\.\d+)?)\s+S:/);
      if (audioLevel) {
        this.health.audioLevelDb = Number.parseFloat(audioLevel[1]);
      }
      this.emit("log", line);
    }
  }

  private async handleExit(code: number, secrets: readonly string[]): Promise<void> {
    if (this.child) this.child = null;
    this.health.pid = null;
    await this.flushLog(secrets);
    if (this.expectedStop) return;

    const request = this.activeRequest;
    const reconnect = request?.reconnect;
    const enabled = reconnect?.enabled !== false;
    const maximumAttempts = clampInteger(reconnect?.maxAttempts, 5, 0, 20);
    if (!request || !enabled || this.health.reconnectAttempt >= maximumAttempts) {
      this.health.lifecycle = "failed";
      this.health.lastError ||=
        code === 0 ? "FFmpeg stopped unexpectedly." : `FFmpeg exited with code ${code}.`;
      this.health.destinations = this.health.destinations.map((destination) => ({
        ...destination,
        state: "degraded",
        detail: "Publishing stopped.",
      }));
      this.activeRequest = null;
      this.emit("state", this.health.lastError);
      return;
    }

    this.health.reconnectAttempt += 1;
    this.health.lifecycle = "reconnecting";
    const initialDelay = clampInteger(reconnect?.initialDelayMs, 1_000, 250, 30_000);
    const maximumDelay = clampInteger(reconnect?.maximumDelayMs, 15_000, initialDelay, 60_000);
    const delay = Math.min(maximumDelay, initialDelay * 2 ** (this.health.reconnectAttempt - 1));
    this.health.destinations = this.health.destinations.map((destination) => ({
      ...destination,
      state: "connecting",
      detail: `Reconnecting in ${delay} ms.`,
    }));
    this.emit("state", `FFmpeg exited; reconnect attempt ${this.health.reconnectAttempt}.`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.restart();
    }, delay);
  }

  private async restart(): Promise<void> {
    if (!this.activeRequest || this.expectedStop) return;
    try {
      const probe = await this.probe();
      if (probe.proofType === "unavailable" || !probe.ffmpegPath) {
        throw new Error(probe.detail);
      }
      const encoder = chooseEncoder(this.activeRequest.encoder, probe.encoders);
      await this.launch(probe.ffmpegPath, encoder);
    } catch (error) {
      const secrets = this.activeRequest.destinations.map((destination) => destination.streamKey);
      this.health.lastError = sanitizeError(error, secrets);
      await this.handleExit(-1, secrets);
    }
  }

  private async flushLog(secrets: readonly string[]): Promise<void> {
    if (!this.options.logDirectory || !this.health.sessionId) return;
    try {
      await mkdir(this.options.logDirectory, { recursive: true });
      const logPath = path.join(this.options.logDirectory, `stream-${this.health.sessionId}.log`);
      await writeFile(logPath, redactMediaLog(this.logLines.join("\n"), secrets), {
        encoding: "utf8",
        mode: 0o600,
      });
    } catch {
      // A diagnostic log failure must not hide the media process outcome.
    }
  }

  private emit(type: MediaEngineEvent["type"], message: string): void {
    this.options.onEvent?.({
      type,
      at: new Date().toISOString(),
      health: this.getHealth(),
      message,
    });
  }
}
