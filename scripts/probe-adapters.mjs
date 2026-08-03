import { access, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const candidates = [
  {
    id: "media-host",
    path: path.join(projectRoot, "build", "media-host", "Release", "PulseCastMediaHost.exe"),
    required: true,
  },
  {
    id: "screen-recorder",
    path:
      process.env.PULSECAST_SCREENRECORDER_PATH ??
      "D:\\Projects\\ScreenRecorder\\build\\Release\\ScreenRecorder.exe",
    required: false,
  },
  {
    id: "ourconsole",
    path: "D:\\Projects\\OurConsole\\build\\OurConsole_artefacts\\Release\\OurConsole.exe",
    required: false,
  },
  {
    id: "tempo",
    path: "D:\\Projects\\unified-render-engine\\main.py",
    required: false,
  },
  {
    id: "pulse-core",
    path: path.join(projectRoot, "vendor", "pulse-engine", "pulse-engine-1.9.0.tgz"),
    required: true,
  },
];

const results = [];
for (const candidate of candidates) {
  try {
    await access(candidate.path);
    const info = await stat(candidate.path);
    const hash = createHash("sha256")
      .update(await readFile(candidate.path))
      .digest("hex");
    results.push({
      id: candidate.id,
      state: "available",
      bytes: info.size,
      sha256: hash,
    });
  } catch {
    results.push({
      id: candidate.id,
      state: "unavailable",
      required: candidate.required,
    });
  }
}

console.log(JSON.stringify({ schema: "pulsecast.adapter-probe/v1", results }, null, 2));
if (results.some((result) => result.required && result.state !== "available")) {
  process.exitCode = 1;
}
