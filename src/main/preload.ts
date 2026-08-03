import { contextBridge, ipcRenderer } from "electron";
import type { CommandEnvelope, PulseCastBridge } from "../shared/contracts";

const bridge: PulseCastBridge = {
  getSnapshot: () => ipcRenderer.invoke("pulsecast:get-snapshot"),
  executeCommand: (command: CommandEnvelope) =>
    ipcRenderer.invoke("pulsecast:execute-command", command),
  resetShow: () => ipcRenderer.invoke("pulsecast:reset-show"),
  createCheckpoint: () => ipcRenderer.invoke("pulsecast:create-checkpoint"),
  simulateInterruption: () => ipcRenderer.invoke("pulsecast:simulate-interruption"),
  getRecoverySummary: () => ipcRenderer.invoke("pulsecast:get-recovery-summary"),
  recover: (mode) => ipcRenderer.invoke("pulsecast:recover", mode),
  exportShow: () => ipcRenderer.invoke("pulsecast:export-show"),
  probeAdapters: () => ipcRenderer.invoke("pulsecast:probe-adapters"),
  getMediaHostProbe: () => ipcRenderer.invoke("pulsecast:media-host:probe"),
  startMediaHostCapture: (windowId) =>
    ipcRenderer.invoke("pulsecast:media-host:capture-start", windowId),
  getMediaHostCapture: () => ipcRenderer.invoke("pulsecast:media-host:capture-status"),
  stopMediaHostCapture: () => ipcRenderer.invoke("pulsecast:media-host:capture-stop"),
  setMediaHostPreview: (bounds) => ipcRenderer.invoke("pulsecast:media-host:preview-set", bounds),
  setMediaHostProgramTransform: (transform) =>
    ipcRenderer.invoke("pulsecast:media-host:program-transform-set", transform),
  runNativeCaptureProof: (options) =>
    ipcRenderer.invoke("pulsecast:run-native-capture-proof", options),
  probeRealMedia: () => ipcRenderer.invoke("pulsecast:media:probe"),
  recordCameraMicProof: (request) => ipcRenderer.invoke("pulsecast:media:record-proof", request),
  startRealStream: (request) => ipcRenderer.invoke("pulsecast:media:start", request),
  getRealStreamHealth: () => ipcRenderer.invoke("pulsecast:media:health"),
  stopRealStream: () => ipcRenderer.invoke("pulsecast:media:stop"),
  subscribeRealMedia: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, event: Parameters<typeof listener>[0]) =>
      listener(event);
    ipcRenderer.on("pulsecast:media:event", handler);
    return () => ipcRenderer.removeListener("pulsecast:media:event", handler);
  },
  openMediaArtifact: (filePath) => ipcRenderer.invoke("pulsecast:media:open-artifact", filePath),
};

contextBridge.exposeInMainWorld("pulsecast", bridge);
