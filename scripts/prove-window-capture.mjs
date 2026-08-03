import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hostPath = path.join(root, "build", "media-host", "Release", "PulseCastMediaHost.exe");
const fixturePath = path.join(root, "scripts", "remote-play-window-fixture.ps1");

function launchFixture(title, handlePath = "") {
  const argumentsList = [
    "-NoProfile",
    "-WindowStyle",
    "Hidden",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
    fixturePath,
    "-Title",
    title,
  ];
  if (handlePath) argumentsList.push("-HandlePath", handlePath);
  return spawn("powershell.exe", argumentsList, { windowsHide: false, stdio: "ignore" });
}

const previewHandlePath = path.join(
  os.tmpdir(),
  `pulsecast-preview-handle-${process.pid}-${Date.now()}.txt`,
);
const fixture = launchFixture("PS Remote Play");
const previewHost = launchFixture("PulseCast Preview Host", previewHandlePath);
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
let previewParentWindowId = "";
try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      previewParentWindowId = (await readFile(previewHandlePath, "ascii")).trim();
    } catch {
      // The fixture writes its HWND after its form is shown.
    }
    if (/^0x[0-9a-f]+$/i.test(previewParentWindowId)) break;
    await sleep(100);
  }
  if (!previewParentWindowId) throw new Error("The preview host HWND was not published.");

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
  const transformed = await command({
    type: "program-transform-set",
    x: 240,
    y: 135,
    width: 1440,
    height: 810,
  });
  if (transformed.program.state === "failed") {
    throw new Error(transformed.program.error || "Program transform failed.");
  }
  const attached = await command({
    type: "preview-attach",
    parentWindowId: previewParentWindowId,
    x: 24,
    y: 120,
    width: 800,
    height: 380,
  });
  if (attached.preview.state === "failed") {
    throw new Error(attached.preview.error || "Shared-texture preview failed to attach.");
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    finalCapture = await command({ type: "capture-status" });
    if (
      finalCapture.state === "active" &&
      finalCapture.frameCount > 0 &&
      finalCapture.program.state === "active" &&
      finalCapture.program.composedFrameCount > 0 &&
      finalCapture.preview.state === "active" &&
      finalCapture.preview.presentedFrameCount > 0
    ) {
      break;
    }
    if (finalCapture.state === "failed") {
      throw new Error(finalCapture.error || "Capture failed before a frame arrived.");
    }
    await sleep(100);
  }
  if (
    !finalCapture ||
    finalCapture.state !== "active" ||
    finalCapture.frameCount < 1 ||
    finalCapture.program.state !== "active" ||
    finalCapture.program.composedFrameCount < 1 ||
    finalCapture.program.outputWidth !== 1920 ||
    finalCapture.program.outputHeight !== 1080 ||
    finalCapture.program.transform.x !== 240 ||
    finalCapture.program.transform.y !== 135 ||
    finalCapture.program.transform.width !== 1440 ||
    finalCapture.program.transform.height !== 810 ||
    finalCapture.preview.state !== "active" ||
    finalCapture.preview.presentedFrameCount < 1
  ) {
    throw new Error("The Program compositor did not compose and present a real captured frame.");
  }

  await command({ type: "preview-detach" });
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
  if (!previewHost.killed) previewHost.kill();
  await rm(previewHandlePath, { force: true });
}
