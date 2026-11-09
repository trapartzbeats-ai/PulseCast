import { z } from "zod";

export type ProofType = "real" | "fault-injected-real" | "simulated" | "mock" | "unavailable";

export type SourceType = "display" | "camera" | "microphone" | "desktop-audio" | "pulse-graphic";

export type DestinationRuntimeState = "idle" | "testing" | "healthy" | "failed" | "reconnecting";

export type AudioHealth = "ok" | "clipping" | "silent" | "disconnected";

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
}

export interface CanvasDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: 30 | 60;
  colorSpace: "BT.709";
}

export interface SourceDefinition {
  id: string;
  name: string;
  type: SourceType;
  adapter: string;
  adapterVersion: string;
  proofType: ProofType;
  privacy: "public" | "private";
  config: Record<string, unknown>;
}

export interface SceneNode {
  id: string;
  sourceId: string;
  zIndex: number;
  transforms: Record<string, Transform>;
}

export interface SceneDefinition {
  id: string;
  name: string;
  baseSceneId?: string;
  nodes: SceneNode[];
  audioSnapshotId: string;
}

export interface RundownItem {
  id: string;
  order: number;
  name: string;
  sceneId: string;
  transition: "cut" | "dissolve" | "pulse";
  audioSnapshotId: string;
  notes: string;
}

export type AudioBusId = "program" | "monitor" | "record";

export interface AudioChannel {
  id: string;
  name: string;
  sourceId: string;
  gainDb: number;
  muted: boolean;
  routes: Record<AudioBusId, boolean>;
  processors: Array<"gate" | "limiter">;
}

export interface DestinationDefinition {
  id: string;
  name: string;
  platform: "twitch" | "facebook";
  adapter: string;
  proofType: "mock";
  canvasId: string;
  credentialRef: null;
}

export interface PulseGraphicDefinition {
  id: string;
  name: string;
  engine: "pulse-core";
  engineVersion: "1.9.x";
  lifecycle: "entrance-loop-exit";
  reducedMotion: "instant-readable-state";
  maxFps: 60;
  destinations: string[];
}

export interface ShowDocument {
  schema: "pulsecast.show/v1";
  id: string;
  revision: number;
  name: string;
  createdAt: string;
  modifiedAt: string;
  settings: {
    userMode: "creator";
    defaultCanvasId: string;
    frameClock: "monotonic-qpc";
  };
  canvases: CanvasDefinition[];
  sources: SourceDefinition[];
  scenes: SceneDefinition[];
  rundown: RundownItem[];
  audio: {
    buses: Array<{ id: AudioBusId; creatorLabel: string }>;
    channels: AudioChannel[];
    snapshots: Array<{ id: string; name: string }>;
  };
  destinations: DestinationDefinition[];
  graphics: PulseGraphicDefinition[];
  requiredModules: {
    pulseCore: "1.9.x";
    ourConsole: "1.x";
    atlas: "1.x";
  };
  credentials: never[];
}

export interface RuntimeState {
  activeRundownItemId: string;
  activeSceneId: string;
  selectedSourceId: string | null;
  safeMode: boolean;
  interrupted: boolean;
  lastCheckpointAt: string | null;
  lastRecoveredAt: string | null;
  destinationStates: Record<string, DestinationRuntimeState>;
  audioHealth: Record<string, AudioHealth>;
  supportEvents: Array<{
    id: string;
    platform: "twitch" | "facebook";
    label: string;
    proofType: "mock";
    occurredAt: string;
  }>;
  pulseTrigger: number;
}

export interface CoreState {
  show: ShowDocument;
  runtime: RuntimeState;
}

export const commandKindSchema = z.enum([
  "scene.activate",
  "source.move",
  "source.select",
  "audio.route",
  "audio.gain",
  "audio.mute",
  "audio.health",
  "destination.state",
  "support.receive",
  "runtime.safe-mode",
]);

export type CommandKind = z.infer<typeof commandKindSchema>;

export const commandEnvelopeSchema = z.object({
  schema: z.literal("pulsecast.command/v1"),
  commandId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  showId: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  kind: commandKindSchema,
  issuedAt: z.string().datetime(),
  actor: z.object({
    kind: z.enum(["user", "assistant", "automation", "system"]),
    id: z.string().min(1),
    role: z.string().min(1),
  }),
  correlationId: z.string().min(1),
  causationId: z.string().nullable(),
  mode: z.enum(["preview", "execute"]),
  payload: z.record(z.string(), z.unknown()),
});

export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

export interface DomainEvent {
  schema: "pulsecast.event/v1";
  eventId: string;
  showId: string;
  stream: string;
  sequence: number;
  type: string;
  version: 1;
  occurredAt: string;
  recordedAt: string;
  correlationId: string;
  causationId: string;
  producer: "pulsecast-core";
  payload: Record<string, unknown>;
}

export interface Violation {
  code: string;
  path: string;
  severity: "error" | "warning";
  message: string;
}

export interface CommandResult {
  schema: "pulsecast.command-result/v1";
  commandId: string;
  status: "accepted" | "rejected" | "conflict";
  revision: number;
  events: string[];
  violations: Violation[];
  snapshot?: CoreState;
}

export interface AdapterStatus {
  id: "media-host" | "screen-recorder" | "ourconsole" | "tempo" | "pulse-core";
  name: string;
  state: "ready" | "degraded" | "unavailable";
  proofType: ProofType;
  version: string | null;
  detail: string;
  capabilities: string[];
}

export interface MediaHostCapability {
  id:
    | "window-discovery"
    | "window-capture"
    | "shared-texture-preview"
    | "process-audio"
    | "program-composition";
  proofType: ProofType;
  state: "ready" | "unavailable";
}

export interface MediaHostWindowCandidate {
  windowId: string;
  processId: number;
  title: string;
  executableName: string;
  className: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MediaHostProbe {
  schema: "pulsecast.media-host-probe/v1";
  adapter: "MediaHostProcessAdapter/v1";
  version: string;
  proofType: "real";
  processId: number;
  capabilities: MediaHostCapability[];
  remotePlay: {
    state: "detected" | "not-detected";
    candidateCount: number;
  };
  candidates: MediaHostWindowCandidate[];
  capture: MediaHostCapture;
}

export interface MediaHostCapture {
  schema: "pulsecast.media-host-capture/v1";
  proofType: "real" | "unavailable";
  state: "idle" | "starting" | "active" | "stalled" | "failed" | "stopped";
  windowId: string | null;
  frameCount: number;
  width: number;
  height: number;
  lastFrameMonotonicMs: number;
  error: string | null;
  program: MediaHostProgram;
  preview: MediaHostPreview;
}

export interface MediaHostProgram {
  proofType: "real" | "unavailable";
  state: "idle" | "waiting" | "active" | "failed";
  composedFrameCount: number;
  outputWidth: number;
  outputHeight: number;
  transform: MediaHostProgramTransform;
  error: string | null;
}

export interface MediaHostProgramTransform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaHostPreview {
  proofType: "real" | "unavailable";
  state: "detached" | "waiting" | "active" | "failed";
  presentedFrameCount: number;
  width: number;
  height: number;
  sharedHandle: string | null;
  error: string | null;
}

export interface MediaHostPreviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativeCaptureProof {
  proofType: "real";
  capability: "display-recording";
  adapter: "ScreenRecorderProcessAdapter/v1";
  success: boolean;
  exitCode: number;
  outputPath: string;
  fileSizeBytes: number;
  resultPath: string;
  logPath: string;
  sha256: string | null;
  encoderSelection: "unverified";
  ffprobe: Record<string, unknown> | null;
  errorMessage: string;
}

export type MediaDeviceKind = "video" | "audio";
export type MediaPlatform = "twitch" | "facebook";
export type MediaStreamLifecycle =
  "idle" | "starting" | "live" | "reconnecting" | "stopping" | "stopped" | "failed";

export interface MediaDevice {
  kind: MediaDeviceKind;
  name: string;
  alternativeName: string | null;
}

export interface MediaEncoderProbe {
  name: "h264_nvenc" | "h264_qsv" | "h264_amf" | "libx264";
  available: boolean;
  hardware: boolean;
}

export interface MediaBackendProbe {
  proofType: "real" | "unavailable";
  adapter: "FfmpegDirectShowAdapter/v1";
  ffmpegPath: string | null;
  ffmpegVersion: string | null;
  devices: MediaDevice[];
  encoders: MediaEncoderProbe[];
  rtmpsSupported: boolean;
  detail: string;
}

export interface MediaCaptureSelection {
  videoDevice: string;
  audioDevice: string;
}

export interface MediaEncodingSettings {
  width?: 1280 | 1920;
  height?: 720 | 1080;
  fps?: 30 | 60;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  encoder?: MediaEncoderProbe["name"] | "auto";
}

export interface CameraMicProofRequest extends MediaCaptureSelection, MediaEncodingSettings {
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
  encoder: MediaEncoderProbe["name"];
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
  ingestBaseUrl?: string;
  bandwidthTest?: boolean;
}

export interface StartRealStreamRequest extends MediaCaptureSelection, MediaEncodingSettings {
  destinations: StreamDestinationRequest[];
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelayMs?: number;
    maximumDelayMs?: number;
  };
}

export interface MediaDestinationHealth {
  id: string;
  platform: MediaPlatform;
  state: "connecting" | "live" | "degraded" | "stopped";
  detail: string;
}

export interface RealStreamHealth {
  proofType: "real";
  adapter: "FfmpegDirectShowAdapter/v1";
  sessionId: string | null;
  lifecycle: MediaStreamLifecycle;
  pid: number | null;
  startedAt: string | null;
  reconnectAttempt: number;
  frame: number;
  outputTimeMs: number;
  speed: string;
  audioLevelDb: number | null;
  destinations: MediaDestinationHealth[];
  lastError: string;
  credentialBoundary: "runtime-memory-and-child-command-line";
}

export interface MediaEngineEvent {
  type: "state" | "progress" | "destination" | "log";
  at: string;
  health: RealStreamHealth;
  message: string;
}

export interface RecoverySummary {
  interrupted: boolean;
  checkpointAt: string | null;
  checksumStatus: "verified" | "missing" | "failed";
  journalEntries: number;
  skippedEntries: number;
}

export type Ps5Platform = "twitch" | "facebook";

export interface Ps5Status {
  /** psrelay.exe, tempo-rtmp.exe and ps5.cfg found next to the app. */
  ready: boolean;
  missing: string[];
  running: boolean;
  live: boolean;
  /** Proof language: "real" only while real PS5 packets are flowing. */
  proof: "real" | "unavailable";
  width: number;
  height: number;
  fps: number;
  videoKbps: number;
  droppedKb: number;
  destinations: Array<{ platform: Ps5Platform; keySet: boolean; state: "idle" | "live" | "error" }>;
  lastEvent: string;
  lastError: string;
}

export interface Ps5StartRequest {
  res: 720 | 1080;
  fps: 30 | 60;
  bitrateKbps: number;
}

/** Buttons use the Remote Play bit layout: cross 0, moon 1, box 2, pyramid 3, left 4, right 5, up 6, down 7,
 *  L1 8, R1 9, L3 10, R3 11, options 12, share 13, touchpad 14, ps 15. Sticks are -32768..32767, triggers 0..255. */
export interface Ps5PadState {
  buttons: number;
  l2: number;
  r2: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

export interface Ps5LiveOptions {
  /** passthrough = the PS5's own H.264 as sent; composited = Studio's scene, encoded once on this PC. */
  mode: "passthrough" | "composited";
  width?: number;
  height?: number;
  fps?: number;
}

export type Ps5VideoPacket = { key: boolean; lost: boolean; ts: number; data: Uint8Array };

export interface Ps5Bridge {
  ps5Status(): Promise<Ps5Status>;
  ps5Start(request: Ps5StartRequest): Promise<Ps5Status>;
  ps5Stop(): Promise<Ps5Status>;
  ps5GoLive(platforms: Ps5Platform[], options?: Ps5LiveOptions): Promise<Ps5Status>;
  /** Composited output (Studio): H.264 from the renderer's encoder and mixed PCM, fed to the RTMP sender. */
  ps5OutVideo(packet: { key: boolean; ts: number; data: Uint8Array }): void;
  ps5OutAudio(pcm: Uint8Array): void;
  subscribePs5Audio(listener: (pcm: Uint8Array) => void): () => void;
  ps5EndLive(): Promise<Ps5Status>;
  /** Stored with Electron safeStorage (Windows DPAPI). The key is never returned. */
  ps5SetKey(platform: Ps5Platform, key: string): Promise<Ps5Status>;
  /** When off, a dropped PS5 session ends the run instead of reconnecting (default on). Takes effect immediately. */
  ps5SetAutoReconnect(on: boolean): void;
  /** Sends throwaway bytes to a public speed-test server for a few seconds and reports this PC's upload speed. */
  netUploadTest(): Promise<{ kbps: number; seconds: number }>;
  /** Controller state read from a gamepad on this PC, sent to the PS5 over Remote Play. */
  ps5Input(state: Ps5PadState): void;
  subscribePs5Video(listener: (packet: Ps5VideoPacket) => void): () => void;
  subscribePs5Status(listener: (status: Ps5Status) => void): () => void;
  /** Screens and open windows (browsers included) that can be shown on the stream. */
  listCaptureSources(): Promise<CaptureSource[]>;
  /** Read a Twitch channel's chat (anonymous, read-only). Messages and sub/raid alerts arrive through subscribeChat. */
  chatConnect(channel: string): Promise<void>;
  chatDisconnect(): Promise<void>;
  /** Facebook Page live comments. The token is stored with Windows secure storage and never returned. */
  chatFacebookSetToken(token: string): Promise<boolean>;
  chatFacebookHasToken(): Promise<boolean>;
  chatFacebookConnect(): Promise<void>;
  chatFacebookDisconnect(): Promise<void>;
  subscribeChat(listener: (event: ChatEvent) => void): () => void;
  /** System-wide keys that work while a game has focus: Ctrl+Alt+B (panic scene), Ctrl+Alt+M (mute mic). */
  subscribeHotkeys(listener: (action: "panic" | "mic") => void): () => void;
}

/** A screen or window the user can put on the stream. Thumbnails are small data URLs shown only in the picker. */
export interface CaptureSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumb: string;
}

export type ChatEvent =
  | { type: "message"; id: string; user: string; color: string; text: string }
  | { type: "alert"; id: string; title: string; detail: string }
  | {
      type: "status";
      source: "twitch" | "facebook";
      state: "off" | "connecting" | "on" | "error";
      detail: string;
    };

export interface PulseCastBridge extends Ps5Bridge {
  getSnapshot(): Promise<CoreState>;
  executeCommand(command: CommandEnvelope): Promise<CommandResult>;
  resetShow(): Promise<CoreState>;
  createCheckpoint(): Promise<CoreState>;
  simulateInterruption(): Promise<RecoverySummary>;
  getRecoverySummary(): Promise<RecoverySummary>;
  recover(mode: "current" | "safe" | "last-known-good"): Promise<CoreState>;
  exportShow(): Promise<{ path: string; sha256: string; entries: string[] }>;
  probeAdapters(): Promise<AdapterStatus[]>;
  getMediaHostProbe(): Promise<MediaHostProbe>;
  startMediaHostCapture(windowId: string): Promise<MediaHostCapture>;
  getMediaHostCapture(): Promise<MediaHostCapture>;
  stopMediaHostCapture(): Promise<MediaHostCapture>;
  setMediaHostPreview(bounds: MediaHostPreviewBounds | null): Promise<MediaHostCapture>;
  setMediaHostProgramTransform(transform: MediaHostProgramTransform): Promise<MediaHostCapture>;
  runNativeCaptureProof(options?: {
    durationMs?: number;
    fps?: 30 | 60;
  }): Promise<NativeCaptureProof>;
  probeRealMedia(): Promise<MediaBackendProbe>;
  recordCameraMicProof(request: CameraMicProofRequest): Promise<CameraMicProofResult>;
  startRealStream(request: StartRealStreamRequest): Promise<RealStreamHealth>;
  getRealStreamHealth(): Promise<RealStreamHealth>;
  stopRealStream(): Promise<RealStreamHealth>;
  subscribeRealMedia(listener: (event: MediaEngineEvent) => void): () => void;
  openMediaArtifact(filePath: string): Promise<{ opened: boolean; error: string }>;
}

export function createCommand(
  state: CoreState,
  kind: CommandKind,
  payload: Record<string, unknown>,
  mode: "preview" | "execute" = "execute",
): CommandEnvelope {
  const id = crypto.randomUUID();
  return {
    schema: "pulsecast.command/v1",
    commandId: id,
    idempotencyKey: id,
    showId: state.show.id,
    baseRevision: state.show.revision,
    kind,
    issuedAt: new Date().toISOString(),
    actor: { kind: "user", id: "local-operator", role: "operator" },
    correlationId: id,
    causationId: null,
    mode,
    payload,
  };
}
