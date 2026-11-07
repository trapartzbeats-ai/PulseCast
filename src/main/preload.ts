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
  ps5Status: () => ipcRenderer.invoke("pulsecast:ps5:status"),
  ps5Start: (request) => ipcRenderer.invoke("pulsecast:ps5:start", request),
  ps5Stop: () => ipcRenderer.invoke("pulsecast:ps5:stop"),
  ps5GoLive: (platforms, options) => ipcRenderer.invoke("pulsecast:ps5:go-live", platforms, options),
  ps5OutVideo: (packet) => ipcRenderer.send("pulsecast:ps5:out-video", packet),
  ps5OutAudio: (pcm) => ipcRenderer.send("pulsecast:ps5:out-audio", pcm),
  subscribePs5Audio: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, pcm: Uint8Array) => listener(pcm);
    ipcRenderer.on("pulsecast:ps5:audio", handler);
    return () => ipcRenderer.removeListener("pulsecast:ps5:audio", handler);
  },
  ps5EndLive: () => ipcRenderer.invoke("pulsecast:ps5:end-live"),
  ps5SetKey: (platform, key) => ipcRenderer.invoke("pulsecast:ps5:set-key", platform, key),
  ps5SetAutoReconnect: (on) => ipcRenderer.send("pulsecast:ps5:auto-reconnect", Boolean(on)),
  ps5Input: (state) => ipcRenderer.send("pulsecast:ps5:input", state),
  subscribePs5Video: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, packet: Parameters<typeof listener>[0]) =>
      listener(packet);
    ipcRenderer.on("pulsecast:ps5:video", handler);
    return () => ipcRenderer.removeListener("pulsecast:ps5:video", handler);
  },
  subscribePs5Status: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: Parameters<typeof listener>[0]) =>
      listener(status);
    ipcRenderer.on("pulsecast:ps5:status", handler);
    return () => ipcRenderer.removeListener("pulsecast:ps5:status", handler);
  },
  openMediaArtifact: (filePath) => ipcRenderer.invoke("pulsecast:media:open-artifact", filePath),
};

contextBridge.exposeInMainWorld("pulsecast", bridge);
