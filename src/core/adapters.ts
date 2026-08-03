import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { AdapterStatus, MediaHostProbe, NativeCaptureProof } from "../shared/contracts";
import { probeMediaHost } from "./media-host";

const execFileAsync = promisify(execFile);

function resolvePulsePackage(): string {
  try {
    return path.resolve(path.dirname(require.resolve("pulse-engine")), "..", "package.json");
  } catch {
    return path.resolve(process.cwd(), "node_modules", "pulse-engine", "package.json");
  }
}

const defaults = {
  screenRecorder: "D:\\Projects\\ScreenRecorder\\build\\Release\\ScreenRecorder.exe",
  ourConsole: "D:\\Projects\\OurConsole\\build\\OurConsole_artefacts\\Release\\OurConsole.exe",
  tempo: "D:\\Projects\\unified-render-engine\\main.py",
  pulsePackage: resolvePulsePackage(),
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageVersion(filePath: string): Promise<string | null> {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8")) as {
      version?: unknown;
    };
    return typeof value.version === "string" ? value.version : null;
  } catch {
    return null;
  }
}

export function getScreenRecorderPath(): string {
  return path.resolve(process.env.PULSECAST_SCREENRECORDER_PATH ?? defaults.screenRecorder);
}

export async function probeAdapters(mediaHostOverride?: {
  probe?: MediaHostProbe;
  error?: string;
}): Promise<AdapterStatus[]> {
  const screenRecorderPath = getScreenRecorderPath();
  const [fallbackMediaHost, screenRecorder, ourConsole, tempo, pulseCore] = await Promise.all([
    mediaHostOverride ? Promise.resolve(null) : probeMediaHost(),
    fileExists(screenRecorderPath),
    fileExists(defaults.ourConsole),
    fileExists(defaults.tempo),
    fileExists(defaults.pulsePackage),
  ]);
  const mediaHost = mediaHostOverride?.probe
    ? {
        available: true as const,
        executablePath: "supervised-process",
        probe: mediaHostOverride.probe,
      }
    : mediaHostOverride?.error
      ? {
          available: false as const,
          executablePath: "supervised-process",
          error: mediaHostOverride.error,
        }
      : fallbackMediaHost!;
  const pulseVersion = pulseCore ? await readPackageVersion(defaults.pulsePackage) : null;

  return [
    {
      id: "media-host",
      name: "PulseCast Media Host",
      state: mediaHost.available ? "ready" : "unavailable",
      proofType: mediaHost.available ? "real" : "unavailable",
      version: mediaHost.available ? mediaHost.probe.version : null,
      detail: mediaHost.available
        ? mediaHost.probe.remotePlay.candidateCount > 0
          ? `Real Windows discovery found ${mediaHost.probe.remotePlay.candidateCount} PS Remote Play window candidate(s). Capture and process audio remain unavailable.`
          : "Real Windows discovery is ready; no PS Remote Play window is currently detected. Capture and process audio remain unavailable."
        : mediaHost.error,
      capabilities: mediaHost.available
        ? [
            "process contract v1",
            "real window discovery",
            `${mediaHost.probe.remotePlay.candidateCount} Remote Play candidate(s)`,
            "window capture unavailable",
            "process audio unavailable",
          ]
        : [],
    },
    {
      id: "screen-recorder",
      name: "ScreenRecorder process adapter",
      state: screenRecorder ? "ready" : "unavailable",
      proofType: screenRecorder ? "real" : "unavailable",
      version: screenRecorder ? "CLI v1" : null,
      detail: screenRecorder
        ? "Real short display-to-MP4 proof. Not the live shared-texture capture path."
        : `Executable was not found at ${screenRecorderPath}.`,
      capabilities: screenRecorder ? ["display capture", "H.264 MP4", "result JSON"] : [],
    },
    {
      id: "ourconsole",
      name: "OURconsole",
      state: ourConsole ? "degraded" : "unavailable",
      proofType: ourConsole ? "real" : "unavailable",
      version: ourConsole ? "installed application" : null,
      detail: ourConsole
        ? "Installed upstream app; a public engine/IPC adapter is still required."
        : "OURconsole executable was not found.",
      capabilities: ourConsole ? ["standalone audio app", "JUCE DSP"] : [],
    },
    {
      id: "tempo",
      name: "Unified Render Engine / Tempo",
      state: tempo ? "degraded" : "unavailable",
      proofType: tempo ? "real" : "unavailable",
      version: tempo ? "offline worker" : null,
      detail: tempo
        ? "Available for offline jobs only; not a live compositor."
        : "Offline render entrypoint was not found.",
      capabilities: tempo ? ["offline render", "artifact fingerprint"] : [],
    },
    {
      id: "pulse-core",
      name: "Pulse Core",
      state: pulseCore ? "ready" : "unavailable",
      proofType: pulseCore ? "real" : "unavailable",
      version: pulseVersion,
      detail: pulseCore
        ? "Canonical public package is available to the renderer."
        : "Pulse Core package was not found.",
      capabilities: pulseCore ? ["canonical owner", "reduced motion", "lifecycle disposal"] : [],
    },
  ];
}

async function sha256File(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function runFfprobe(outputPath: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,codec_type,width,height,avg_frame_rate",
        "-of",
        "json",
        outputPath,
      ],
      { windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024 },
    );
    return JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function runNativeCaptureProof(
  proofRoot: string,
  options: { durationMs?: number; fps?: 30 | 60 } = {},
): Promise<NativeCaptureProof> {
  const executable = getScreenRecorderPath();
  const available = await fileExists(executable);
  if (!available) {
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
      errorMessage: `ScreenRecorder executable is unavailable at ${executable}.`,
    };
  }

  const durationMs = Math.max(500, Math.min(10_000, options.durationMs ?? 1200));
  const fps = options.fps === 60 ? 60 : 30;
  const id = `${Date.now()}-${process.pid}`;
  const outputPath = path.join(proofRoot, `display-proof-${id}.mp4`);
  const resultPath = path.join(proofRoot, `display-proof-${id}.result.json`);
  const logPath = path.join(proofRoot, `display-proof-${id}.log`);

  let exitCode = 0;
  let processError = "";
  try {
    await execFileAsync(
      executable,
      [
        "--region",
        "0,0,640,360",
        "--output",
        outputPath,
        "--duration-ms",
        String(durationMs),
        "--fps",
        String(fps),
        "--bitrate",
        "4000000",
        "--result-json",
        resultPath,
        "--log",
        logPath,
        "--quiet",
        "--no-badge",
      ],
      {
        windowsHide: true,
        timeout: durationMs + 20_000,
        maxBuffer: 1024 * 1024,
      },
    );
  } catch (error) {
    const typed = error as Error & { code?: number | string };
    exitCode = typeof typed.code === "number" ? typed.code : -1;
    processError = typed.message;
  }

  let result: {
    success?: boolean;
    exitCode?: number;
    outputPath?: string;
    fileSizeBytes?: number;
    errorMessage?: string;
  } = {};
  try {
    result = JSON.parse(await readFile(resultPath, "utf8")) as typeof result;
  } catch {
    processError ||= "Native result JSON was not produced.";
  }

  const success =
    exitCode === 0 &&
    result.success === true &&
    result.outputPath === outputPath &&
    typeof result.fileSizeBytes === "number" &&
    result.fileSizeBytes > 0 &&
    (await fileExists(outputPath));

  return {
    proofType: "real",
    capability: "display-recording",
    adapter: "ScreenRecorderProcessAdapter/v1",
    success,
    exitCode: result.exitCode ?? exitCode,
    outputPath,
    fileSizeBytes: result.fileSizeBytes ?? 0,
    resultPath,
    logPath,
    sha256: success ? await sha256File(outputPath) : null,
    encoderSelection: "unverified",
    ffprobe: success ? await runFfprobe(outputPath) : null,
    errorMessage:
      result.errorMessage ?? processError ?? (success ? "" : "Native recording proof failed."),
  };
}
