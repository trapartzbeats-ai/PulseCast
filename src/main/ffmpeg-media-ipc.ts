import { shell, type IpcMain } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  FfmpegMediaEngine,
  recordCameraMicProof,
  type CameraMicProofRequest,
  type MediaEngineEvent,
} from "../core/ffmpeg-media";

export const ffmpegMediaIpcChannels = {
  probe: "pulsecast:media:probe",
  recordProof: "pulsecast:media:record-proof",
  start: "pulsecast:media:start",
  health: "pulsecast:media:health",
  stop: "pulsecast:media:stop",
  openArtifact: "pulsecast:media:open-artifact",
  event: "pulsecast:media:event",
} as const;

export interface RegisterFfmpegMediaIpcOptions {
  ipcMain: IpcMain;
  proofDirectory: string;
  logDirectory: string;
  ffmpegPath?: string;
  publishEvent?: (channel: string, event: MediaEngineEvent) => void;
}

type ProofIpcRequest = Omit<CameraMicProofRequest, "outputDirectory">;

/**
 * Registers the narrow Electron boundary for the real FFmpeg worker.
 *
 * The renderer can select devices for bounded media proof, but it cannot choose
 * proof/log filesystem paths. Product network output remains disabled until
 * Program binding and vault-backed credentials satisfy Gate 4.
 */
export function registerFfmpegMediaIpc(options: RegisterFfmpegMediaIpcOptions): {
  engine: FfmpegMediaEngine;
  dispose: () => Promise<void>;
} {
  const { ipcMain } = options;
  const engine = new FfmpegMediaEngine({
    ffmpegPath: options.ffmpegPath,
    logDirectory: options.logDirectory,
    onEvent: (event) => options.publishEvent?.(ffmpegMediaIpcChannels.event, event),
  });

  ipcMain.handle(ffmpegMediaIpcChannels.probe, () => engine.probe());
  ipcMain.handle(ffmpegMediaIpcChannels.recordProof, (_event, request: ProofIpcRequest) =>
    recordCameraMicProof(
      { ...request, outputDirectory: options.proofDirectory },
      options.ffmpegPath,
    ),
  );
  ipcMain.handle(ffmpegMediaIpcChannels.start, () => {
    throw new Error(
      "Destination routing is unavailable until Program media binding and Windows Credential Manager are certified.",
    );
  });
  ipcMain.handle(ffmpegMediaIpcChannels.health, () => engine.getHealth());
  ipcMain.handle(ffmpegMediaIpcChannels.stop, () => engine.stop());
  ipcMain.handle(ffmpegMediaIpcChannels.openArtifact, async (_event, requestedPath: string) => {
    const root = `${path.resolve(options.proofDirectory).toLowerCase()}${path.sep}`;
    const resolved = path.resolve(requestedPath);
    if (!resolved.toLowerCase().startsWith(root)) {
      return {
        opened: false,
        error: "Only PulseCast media-proof artifacts can be opened.",
      };
    }
    try {
      if (!(await stat(resolved)).isFile()) {
        return { opened: false, error: "The media artifact is not a file." };
      }
    } catch {
      return { opened: false, error: "The media artifact no longer exists." };
    }
    const error = await shell.openPath(resolved);
    return { opened: error.length === 0, error };
  });

  return {
    engine,
    dispose: async () => {
      for (const channel of [
        ffmpegMediaIpcChannels.probe,
        ffmpegMediaIpcChannels.recordProof,
        ffmpegMediaIpcChannels.start,
        ffmpegMediaIpcChannels.health,
        ffmpegMediaIpcChannels.stop,
        ffmpegMediaIpcChannels.openArtifact,
      ]) {
        ipcMain.removeHandler(channel);
      }
      await engine.stop();
    },
  };
}
