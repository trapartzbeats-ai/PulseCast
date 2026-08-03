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
  id: "screen-recorder" | "ourconsole" | "tempo" | "pulse-core";
  name: string;
  state: "ready" | "degraded" | "unavailable";
  proofType: ProofType;
  version: string | null;
  detail: string;
  capabilities: string[];
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

export interface PulseCastBridge {
  getSnapshot(): Promise<CoreState>;
  executeCommand(command: CommandEnvelope): Promise<CommandResult>;
  resetShow(): Promise<CoreState>;
  createCheckpoint(): Promise<CoreState>;
  simulateInterruption(): Promise<RecoverySummary>;
  getRecoverySummary(): Promise<RecoverySummary>;
  recover(mode: "current" | "safe" | "last-known-good"): Promise<CoreState>;
  exportShow(): Promise<{ path: string; sha256: string; entries: string[] }>;
  probeAdapters(): Promise<AdapterStatus[]>;
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
