import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { MediaHostCapture, MediaHostProbe } from "../shared/contracts";
import { getMediaHostPath, parseMediaHostCapture, parseMediaHostProbe } from "./media-host";

interface PendingResponse {
  resolve(value: string): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

export class MediaHostClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  private readonly pending: PendingResponse[] = [];

  constructor(private readonly executablePath = getMediaHostPath()) {}

  start(): void {
    if (this.child) return;
    const child = spawn(this.executablePath, ["--serve"], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.stdoutBuffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      this.consumeStdout(chunk.toString("utf8"));
    });
    child.stderr.on("data", () => undefined);
    child.on("error", (error) => {
      this.rejectPending(error);
    });
    child.on("close", (code) => {
      if (this.child === child) this.child = null;
      this.rejectPending(new Error(`Media Host exited before replying (code ${code ?? -1}).`));
    });
  }

  async probe(): Promise<MediaHostProbe> {
    const line = await this.request({ type: "probe" });
    return parseMediaHostProbe(line);
  }

  async startCapture(windowId: string): Promise<MediaHostCapture> {
    return parseMediaHostCapture(await this.request({ type: "capture-start", windowId }));
  }

  async captureStatus(): Promise<MediaHostCapture> {
    return parseMediaHostCapture(await this.request({ type: "capture-status" }));
  }

  async stopCapture(): Promise<MediaHostCapture> {
    return parseMediaHostCapture(await this.request({ type: "capture-stop" }));
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    try {
      await this.request({ type: "shutdown" }, 2_000);
    } catch {
      child.kill();
    }
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 2_000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (this.child === child) this.child = null;
  }

  private request(
    command:
      | { type: "probe" | "capture-status" | "capture-stop" | "shutdown" }
      | { type: "capture-start"; windowId: string },
    timeoutMs = 5_000,
  ): Promise<string> {
    this.start();
    const child = this.child;
    if (!child) return Promise.reject(new Error("Media Host did not start."));

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.pending.findIndex((candidate) => candidate.resolve === resolve);
        if (index >= 0) this.pending.splice(index, 1);
        reject(new Error(`Media Host ${command.type} request timed out.`));
      }, timeoutMs);
      this.pending.push({ resolve, reject, timer });
      child.stdin.write(
        `${JSON.stringify({
          schema: "pulsecast.media-host-command/v1",
          ...command,
        })}\n`,
      );
    });
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const pending = this.pending.shift();
      if (!pending) continue;
      clearTimeout(pending.timer);
      pending.resolve(line);
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.splice(0)) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }
}
