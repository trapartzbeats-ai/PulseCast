import { createDefaultState } from "../core/default-show";
import { applyCommand } from "../core/reducer";
import type {
  AdapterStatus,
  NativeCaptureProof,
  PulseCastBridge,
  RecoverySummary,
} from "../shared/contracts";

let browserState = createDefaultState();
let browserCheckpoint = structuredClone(browserState);
let browserInterrupted = false;

const browserBridge: PulseCastBridge = {
  async getSnapshot() {
    return structuredClone(browserState);
  },
  async executeCommand(command) {
    const outcome = applyCommand(browserState, command);
    if (outcome.result.status === "accepted" && command.mode === "execute") {
      browserState = outcome.state;
    }
    return structuredClone(outcome.result);
  },
  async resetShow() {
    browserState = createDefaultState();
    browserCheckpoint = structuredClone(browserState);
    browserInterrupted = false;
    return structuredClone(browserState);
  },
  async createCheckpoint() {
    browserState.runtime.lastCheckpointAt = new Date().toISOString();
    browserCheckpoint = structuredClone(browserState);
    return structuredClone(browserState);
  },
  async simulateInterruption() {
    browserState.runtime.lastCheckpointAt = new Date().toISOString();
    browserState.runtime.interrupted = true;
    browserCheckpoint = structuredClone(browserState);
    browserInterrupted = true;
    return {
      interrupted: true,
      checkpointAt: browserState.runtime.lastCheckpointAt,
      checksumStatus: "verified",
      journalEntries: browserState.show.revision,
      skippedEntries: 0,
    };
  },
  async getRecoverySummary(): Promise<RecoverySummary> {
    return {
      interrupted: browserInterrupted,
      checkpointAt: browserCheckpoint.runtime.lastCheckpointAt,
      checksumStatus: "verified",
      journalEntries: browserState.show.revision,
      skippedEntries: 0,
    };
  },
  async recover(mode) {
    browserState = structuredClone(browserCheckpoint);
    browserState.runtime.interrupted = false;
    browserState.runtime.safeMode = mode === "safe";
    browserState.runtime.lastRecoveredAt = new Date().toISOString();
    Object.keys(browserState.runtime.destinationStates).forEach((id) => {
      browserState.runtime.destinationStates[id] = "idle";
    });
    browserInterrupted = false;
    return structuredClone(browserState);
  },
  async exportShow() {
    throw new Error("Open the Electron app to export a .pcast file.");
  },
  async probeAdapters(): Promise<AdapterStatus[]> {
    return [
      {
        id: "media-host",
        name: "PulseCast Media Host",
        state: "unavailable",
        proofType: "unavailable",
        version: null,
        detail: "Native Windows Graphics Capture is available in Electron, not browser preview.",
        capabilities: [],
      },
      {
        id: "screen-recorder",
        name: "ScreenRecorder process adapter",
        state: "unavailable",
        proofType: "unavailable",
        version: null,
        detail: "Native process access is available in Electron, not browser preview.",
        capabilities: [],
      },
      {
        id: "ourconsole",
        name: "OURconsole",
        state: "unavailable",
        proofType: "unavailable",
        version: null,
        detail: "Native process access is available in Electron.",
        capabilities: [],
      },
      {
        id: "tempo",
        name: "Unified Render Engine / Tempo",
        state: "unavailable",
        proofType: "unavailable",
        version: null,
        detail: "Offline worker access is available in Electron.",
        capabilities: [],
      },
      {
        id: "pulse-core",
        name: "Pulse Core",
        state: "ready",
        proofType: "real",
        version: "1.9.0",
        detail: "Canonical package is mounted in this renderer.",
        capabilities: ["canonical owner", "reduced motion", "lifecycle disposal"],
      },
    ];
  },
  async getMediaHostProbe() {
    throw new Error("Open the Electron app to discover PS Remote Play windows.");
  },
  async startMediaHostCapture() {
    throw new Error("Open the Electron app to start Windows Graphics Capture.");
  },
  async getMediaHostCapture() {
    throw new Error("Open the Electron app to inspect Windows Graphics Capture.");
  },
  async stopMediaHostCapture() {
    throw new Error("Open the Electron app to stop Windows Graphics Capture.");
  },
  async setMediaHostPreview() {
    throw new Error("Open the Electron app to present the native shared-texture preview.");
  },
  async runNativeCaptureProof(): Promise<NativeCaptureProof> {
    return {
      proofType: "real",
      capability: "display-recording",
      adapter: "ScreenRecorderProcessAdapter/v1",
      success: false,
      exitCode: -1,
      outputPath: "",
      fileSizeBytes: 0,
      resultPath: "",
      logPath: "",
      sha256: null,
      encoderSelection: "unverified",
      ffprobe: null,
      errorMessage: "Open the Electron app to run native capture proof.",
    };
  },
  async probeRealMedia() {
    return {
      proofType: "unavailable",
      adapter: "FfmpegDirectShowAdapter/v1",
      ffmpegPath: null,
      ffmpegVersion: null,
      devices: [],
      encoders: [
        { name: "h264_nvenc", available: false, hardware: true },
        { name: "h264_qsv", available: false, hardware: true },
        { name: "h264_amf", available: false, hardware: true },
        { name: "libx264", available: false, hardware: false },
      ],
      rtmpsSupported: false,
      detail: "Real camera, microphone, and RTMPS workers require Electron.",
    };
  },
  async recordCameraMicProof() {
    throw new Error("Open the Electron app to record real camera and microphone proof.");
  },
  async startRealStream() {
    throw new Error("Open the Electron app to start a real stream.");
  },
  async getRealStreamHealth() {
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
      lastError: "Real media is unavailable in browser preview.",
      credentialBoundary: "runtime-memory-and-child-command-line",
    };
  },
  async stopRealStream() {
    return this.getRealStreamHealth();
  },
  subscribeRealMedia() {
    return () => undefined;
  },
  async openMediaArtifact() {
    return {
      opened: false,
      error: "Media artifacts can only be opened from Electron.",
    };
  },
};

export function getBridge(): PulseCastBridge {
  return window.pulsecast ?? browserBridge;
}

export function isElectronBridge(): boolean {
  return Boolean(window.pulsecast);
}
