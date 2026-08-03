import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hostPath = path.join(root, "build", "media-host", "Release", "PulseCastMediaHost.exe");
const fixturePath = path.join(root, "scripts", "remote-play-window-fixture.ps1");

const fixture = spawn(
  "powershell.exe",
  [
    "-NoProfile",
    "-WindowStyle",
    "Hidden",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
    fixturePath,
  ],
  { windowsHide: false, stdio: "ignore" },
);
const host = spawn(hostPath, ["--serve"], {
  windowsHide: true,
  stdio: ["pipe", "pipe", "pipe"],
});
const lines = readline.createInterface({ input: host.stdout });
const replies = [];
const waiters = [];

lines.on("line", (line) => {
  const waiter = waiters.shift();
  if (waiter) waiter.resolve(line);
  else replies.push(line);
});

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nextLine(timeoutMs = 5_000) {
  if (replies.length > 0) return Promise.resolve(replies.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Media Host response timed out.")), timeoutMs);
    waiters.push({
      resolve(line) {
        clearTimeout(timer);
        resolve(line);
      },
    });
  });
}

async function command(value) {
  host.stdin.write(`${JSON.stringify({ schema: "pulsecast.media-host-command/v1", ...value })}\n`);
  return JSON.parse(await nextLine());
}

let finalCapture = null;
let candidate = null;
try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const probe = await command({ type: "probe" });
    candidate = probe.candidates.find(
      (entry) => entry.title === "PS Remote Play" && /powershell\.exe/i.test(entry.executableName),
    );
    if (candidate) break;
    await sleep(100);
  }
  if (!candidate) throw new Error("The mock Remote Play fixture was not discovered.");

  const started = await command({ type: "capture-start", windowId: candidate.windowId });
  if (started.state === "failed") throw new Error(started.error || "Capture failed to start.");

  for (let attempt = 0; attempt < 50; attempt += 1) {
    finalCapture = await command({ type: "capture-status" });
    if (finalCapture.state === "active" && finalCapture.frameCount > 0) break;
    if (finalCapture.state === "failed") {
      throw new Error(finalCapture.error || "Capture failed before a frame arrived.");
    }
    await sleep(100);
  }
  if (!finalCapture || finalCapture.state !== "active" || finalCapture.frameCount < 1) {
    throw new Error("Windows Graphics Capture did not produce a real frame.");
  }

  await command({ type: "capture-stop" });
  await command({ type: "shutdown" });
  process.stdout.write(
    `${JSON.stringify(
      {
        schema: "pulsecast.window-capture-proof/v1",
        proofType: "fault-injected-real",
        fixture: "mock-remote-play-window",
        candidate: {
          windowId: candidate.windowId,
          title: candidate.title,
          executableName: candidate.executableName,
        },
        capture: finalCapture,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  lines.close();
  if (!host.killed) host.kill();
  if (!fixture.killed) fixture.kill();
}
