import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { MediaHostCapture, MediaHostProbe } from "../shared/contracts";

const execFileAsync = promisify(execFile);

const proofTypeSchema = z.enum(["real", "fault-injected-real", "simulated", "mock", "unavailable"]);

const mediaHostCaptureSchema = z.object({
  schema: z.literal("pulsecast.media-host-capture/v1"),
  proofType: z.enum(["real", "unavailable"]),
  state: z.enum(["idle", "starting", "active", "stalled", "failed", "stopped"]),
  windowId: z
    .string()
    .regex(/^0x[0-9a-f]+$/i)
    .nullable(),
  frameCount: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  lastFrameMonotonicMs: z.number().int().nonnegative(),
  error: z.string().nullable(),
});

const mediaHostProbeSchema = z.object({
  schema: z.literal("pulsecast.media-host-probe/v1"),
  adapter: z.literal("MediaHostProcessAdapter/v1"),
  version: z.string().min(1),
  proofType: z.literal("real"),
  processId: z.number().int().positive(),
  capabilities: z.array(
    z.object({
      id: z.enum(["window-discovery", "window-capture", "process-audio", "program-composition"]),
      proofType: proofTypeSchema,
      state: z.enum(["ready", "unavailable"]),
    }),
  ),
  remotePlay: z.object({
    state: z.enum(["detected", "not-detected"]),
    candidateCount: z.number().int().nonnegative(),
  }),
  candidates: z.array(
    z.object({
      windowId: z.string().regex(/^0x[0-9a-f]+$/i),
      processId: z.number().int().positive(),
      title: z.string().min(1),
      executableName: z.string(),
      className: z.string(),
      bounds: z.object({
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    }),
  ),
  capture: mediaHostCaptureSchema,
});

async function exists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export function getMediaHostPath(): string {
  return path.resolve(
    process.env.PULSECAST_MEDIA_HOST_PATH ??
      path.join(process.cwd(), "build", "media-host", "Release", "PulseCastMediaHost.exe"),
  );
}

export function parseMediaHostProbe(value: string): MediaHostProbe {
  const parsed = mediaHostProbeSchema.parse(JSON.parse(value));
  if (parsed.remotePlay.candidateCount !== parsed.candidates.length) {
    throw new Error("Media Host candidate count does not match its candidate list.");
  }
  for (const capability of parsed.capabilities) {
    const implemented = capability.id === "window-discovery" || capability.id === "window-capture";
    if (
      (implemented && (capability.proofType !== "real" || capability.state !== "ready")) ||
      (!implemented &&
        (capability.proofType !== "unavailable" || capability.state !== "unavailable"))
    ) {
      throw new Error(`Media Host capability ${capability.id} has an invalid proof label.`);
    }
  }
  return parsed;
}

export function parseMediaHostCapture(value: string): MediaHostCapture {
  const parsed = mediaHostCaptureSchema.parse(JSON.parse(value));
  const hasFrames = parsed.frameCount > 0;
  if (
    (hasFrames && parsed.proofType !== "real") ||
    (!hasFrames && parsed.proofType !== "unavailable")
  ) {
    throw new Error("Media Host capture proof label does not match its frame count.");
  }
  if (parsed.state === "active" && !hasFrames) {
    throw new Error("Media Host cannot report active capture without a real frame.");
  }
  return parsed;
}

export async function probeMediaHost(
  executablePath = getMediaHostPath(),
): Promise<
  | { available: true; executablePath: string; probe: MediaHostProbe }
  | { available: false; executablePath: string; error: string }
> {
  if (!(await exists(executablePath))) {
    return {
      available: false,
      executablePath,
      error: `Media Host executable was not found at ${executablePath}.`,
    };
  }

  try {
    const result = await execFileAsync(executablePath, ["--probe-json"], {
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      available: true,
      executablePath,
      probe: parseMediaHostProbe(result.stdout.trim()),
    };
  } catch (error) {
    return {
      available: false,
      executablePath,
      error: error instanceof Error ? error.message : "Media Host probe failed.",
    };
  }
}
