import { app, BrowserWindow, ipcMain, screen, session } from "electron";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { probeAdapters, runNativeCaptureProof } from "../core/adapters";
import { MediaHostClient } from "../core/media-host-client";
import { FileShowRepository } from "../core/repository";
import { CoreRuntime } from "../core/runtime";
import type {
  CommandEnvelope,
  MediaHostPreviewBounds,
  MediaHostProgramTransform,
} from "../shared/contracts";
import { registerFfmpegMediaIpc } from "./ffmpeg-media-ipc";

let mainWindow: BrowserWindow | null = null;
let runtime: CoreRuntime | null = null;
let mediaIpc: ReturnType<typeof registerFfmpegMediaIpc> | null = null;
let mediaHostClient: MediaHostClient | null = null;
let mediaHostStartupError = "";
let quitReady = false;

if (process.env.PULSECAST_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.PULSECAST_DATA_DIR));
}

if (app.isPackaged && !process.env.PULSECAST_MEDIA_HOST_PATH) {
  process.env.PULSECAST_MEDIA_HOST_PATH = path.join(
    process.resourcesPath,
    "media-host",
    "PulseCastMediaHost.exe",
  );
}

function requireRuntime(): CoreRuntime {
  if (!runtime) throw new Error("PulseCast core is unavailable.");
  return runtime;
}

function requireMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("PulseCast window is unavailable.");
  }
  return mainWindow;
}

function mainWindowId(window: BrowserWindow): string {
  const handle = window.getNativeWindowHandle();
  const value = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
  return `0x${value.toString(16)}`;
}

function physicalPreviewBounds(
  window: BrowserWindow,
  bounds: MediaHostPreviewBounds,
): MediaHostPreviewBounds {
  const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
  const integer = (value: number, minimum: number, maximum: number) =>
    Math.max(minimum, Math.min(maximum, Math.round(value * scale)));
  return {
    x: integer(bounds.x, -32_768, 32_768),
    y: integer(bounds.y, -32_768, 32_768),
    width: integer(bounds.width, 1, 16_384),
    height: integer(bounds.height, 1, 16_384),
  };
}

function registerIpc(): void {
  ipcMain.handle("pulsecast:get-snapshot", () => requireRuntime().getSnapshot());
  ipcMain.handle("pulsecast:execute-command", (_event, command: CommandEnvelope) =>
    requireRuntime().execute(command),
  );
  ipcMain.handle("pulsecast:reset-show", () => requireRuntime().reset());
  ipcMain.handle("pulsecast:create-checkpoint", () => requireRuntime().createCheckpoint());
  ipcMain.handle("pulsecast:simulate-interruption", () => requireRuntime().simulateInterruption());
  ipcMain.handle("pulsecast:get-recovery-summary", () => requireRuntime().getRecoverySummary());
  ipcMain.handle("pulsecast:recover", (_event, mode: "current" | "safe" | "last-known-good") =>
    requireRuntime().recover(mode),
  );
  ipcMain.handle("pulsecast:export-show", () => requireRuntime().exportShow());
  ipcMain.handle("pulsecast:probe-adapters", async () => {
    try {
      if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
      return probeAdapters({ probe: await mediaHostClient.probe() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media Host probe failed.";
      mediaHostStartupError ||= message;
      return probeAdapters({ error: message });
    }
  });
  ipcMain.handle("pulsecast:media-host:probe", () => {
    if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
    return mediaHostClient.probe();
  });
  ipcMain.handle("pulsecast:media-host:capture-start", (_event, windowId: string) => {
    if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
    return mediaHostClient.startCapture(windowId);
  });
  ipcMain.handle("pulsecast:media-host:capture-status", () => {
    if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
    return mediaHostClient.captureStatus();
  });
  ipcMain.handle("pulsecast:media-host:capture-stop", () => {
    if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
    return mediaHostClient.stopCapture();
  });
  ipcMain.handle(
    "pulsecast:media-host:preview-set",
    (_event, bounds: MediaHostPreviewBounds | null) => {
      if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
      if (!bounds) return mediaHostClient.detachPreview();
      const window = requireMainWindow();
      return mediaHostClient.attachPreview(
        mainWindowId(window),
        physicalPreviewBounds(window, bounds),
      );
    },
  );
  ipcMain.handle(
    "pulsecast:media-host:program-transform-set",
    (_event, transform: MediaHostProgramTransform) => {
      if (!mediaHostClient) throw new Error("Media Host supervisor is unavailable.");
      return mediaHostClient.setProgramTransform(transform);
    },
  );
  ipcMain.handle(
    "pulsecast:run-native-capture-proof",
    async (_event, options: { durationMs?: number; fps?: 30 | 60 }) => {
      const proofRoot = path.join(app.getPath("userData"), "proofs");
      await mkdir(proofRoot, { recursive: true });
      return runNativeCaptureProof(proofRoot, options);
    },
  );
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    title: "PulseCast Studio",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: "#080a0d",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const developmentUrl = process.env.PULSECAST_DEV_URL;
  if (developmentUrl) {
    await mainWindow.loadURL(developmentUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  const repository = new FileShowRepository(app.getPath("userData"));
  runtime = new CoreRuntime(repository);
  await runtime.initialize();
  mediaHostClient = new MediaHostClient();
  try {
    mediaHostClient.start();
    await mediaHostClient.probe();
  } catch (error) {
    mediaHostStartupError = error instanceof Error ? error.message : "Media Host startup failed.";
  }
  registerIpc();
  mediaIpc = registerFfmpegMediaIpc({
    ipcMain,
    proofDirectory: path.join(app.getPath("userData"), "media-proofs"),
    logDirectory: path.join(app.getPath("userData"), "media-logs"),
    publishEvent: (channel, event) => mainWindow?.webContents.send(channel, event),
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" && webContents.id === mainWindow?.webContents.id);
  });
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission) =>
      permission === "media" && webContents?.id === mainWindow?.webContents.id,
  );
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("before-quit", (event) => {
  if (quitReady) return;
  event.preventDefault();
  void Promise.all([mediaHostClient?.stop(), mediaIpc?.dispose(), runtime?.close()])
    .catch(() => undefined)
    .finally(() => {
      quitReady = true;
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
