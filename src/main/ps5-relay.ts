import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeStorage } from "electron";
import type {
  Ps5LiveOptions,
  Ps5PadState,
  Ps5Platform,
  Ps5StartRequest,
  Ps5Status,
  Ps5VideoPacket,
} from "../shared/contracts";

/**
 * PS5 Remote Play -> preview + RTMP, with no capture card and no video re-encode.
 *
 *   psrelay.exe (chiaki-ng, AGPL, own process)  --stdout packets-->  this module
 *     -> renderer preview (H.264 as-is, decoded by WebCodecs)
 *     -> tempo-rtmp.exe stdin (only while Go Live is on) -> Twitch / Facebook
 *
 * Packet header (little endian, 16 bytes): u8 type, u8 flags, u16 reserved, u32 length, u64 ts_us.
 * type 1 video (flags bit0 key, bit1 frames lost), 3 audio header, 4 video info, 5 PCM.
 */

const BASES: Record<Ps5Platform, string> = {
  twitch: "rtmp://live.twitch.tv/app/",
  facebook: "rtmps://live-api-s.facebook.com:443/rtmp/",
};

interface Options {
  /** Folder holding bin/psrelay.exe, bin/tempo-rtmp.exe and ps5.cfg. */
  psDir: string;
  /** Where the encrypted stream keys live. */
  dataDir: string;
  publishVideo(packet: Ps5VideoPacket): void;
  publishAudio(pcm: Uint8Array): void;
  publishStatus(status: Ps5Status): void;
}

export class Ps5Relay {
  private relay: ChildProcess | null = null;
  private tempo: ChildProcess | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private headers: Buffer[] = []; // last type 3 and type 4 packets, replayed to a late tempo-rtmp
  private lastParams: Buffer | null = null;
  private tempoNeedKey = true;
  private keys = new Map<Ps5Platform, string>();
  private liveOrder: Ps5Platform[] = [];
  private destState = new Map<Ps5Platform, "idle" | "live" | "error">();
  private status: Ps5Status;
  private lastPublish = 0;
  private starting = false;
  private composited = false;
  private lastRequest: Ps5StartRequest | null = null;
  private userStopped = true;
  private autoReconnect = true;
  private retries = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: Options) {
    this.status = this.blank();
  }

  private get bin(): string {
    return path.join(this.options.psDir, "bin");
  }

  /** The pairing file: the user's data folder first (installed app), then next to bin/ (source checkout). */
  private get cfg(): string {
    const own = path.join(this.options.dataDir, "ps5.cfg");
    return existsSync(own) ? own : path.join(this.options.psDir, "ps5.cfg");
  }

  private missing(): string[] {
    const need: Array<[string, string]> = [
      [path.join(this.bin, "psrelay.exe"), "bin/psrelay.exe"],
      [path.join(this.bin, "tempo-rtmp.exe"), "bin/tempo-rtmp.exe"],
      [this.cfg, `ps5.cfg (pair the PS5, then put it in ${this.options.dataDir})`],
    ];
    return need.filter(([file]) => !existsSync(file)).map(([, label]) => label);
  }

  private blank(): Ps5Status {
    const missing = this.missing();
    return {
      ready: missing.length === 0,
      missing,
      running: false,
      live: false,
      proof: "unavailable",
      width: 0,
      height: 0,
      fps: 0,
      videoKbps: 0,
      droppedKb: 0,
      destinations: (["twitch", "facebook"] as Ps5Platform[]).map((platform) => ({
        platform,
        keySet: this.keys.has(platform),
        state: this.destState.get(platform) ?? "idle",
      })),
      lastEvent: "",
      lastError: "",
    };
  }

  private publish(force = true): void {
    const now = Date.now();
    if (!force && now - this.lastPublish < 500) return;
    this.lastPublish = now;
    this.status.destinations = (["twitch", "facebook"] as Ps5Platform[]).map((platform) => ({
      platform,
      keySet: this.keys.has(platform),
      state: this.destState.get(platform) ?? "idle",
    }));
    this.status.live = this.tempo !== null;
    this.options.publishStatus({ ...this.status });
  }

  async init(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.keyFile(), "utf8")) as Record<string, string>;
      if (safeStorage.isEncryptionAvailable()) {
        for (const platform of ["twitch", "facebook"] as Ps5Platform[]) {
          if (raw[platform]) {
            this.keys.set(
              platform,
              safeStorage.decryptString(Buffer.from(raw[platform], "base64")),
            );
          }
        }
      }
    } catch {
      // no keys stored yet
    }
    this.status = this.blank();
  }

  private keyFile(): string {
    return path.join(this.options.dataDir, "ps5-keys.json");
  }

  getStatus(): Ps5Status {
    const next = { ...this.status, ...this.shape() };
    return next;
  }

  private shape(): Pick<Ps5Status, "ready" | "missing" | "running" | "live" | "destinations"> {
    const missing = this.missing();
    return {
      ready: missing.length === 0,
      missing,
      running: this.relay !== null || this.reconnectTimer !== null,
      live: this.tempo !== null,
      destinations: (["twitch", "facebook"] as Ps5Platform[]).map((platform) => ({
        platform,
        keySet: this.keys.has(platform),
        state: this.destState.get(platform) ?? "idle",
      })),
    };
  }

  async setKey(platform: Ps5Platform, key: string): Promise<Ps5Status> {
    const value = key.trim();
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Windows secure storage is unavailable; the key was not saved.");
    }
    if (value)
      this.keys.set(platform, /^rtmps?:\/\//i.test(value) ? value : BASES[platform] + value);
    else this.keys.delete(platform);
    const out: Record<string, string> = {};
    for (const [name, url] of this.keys) {
      out[name] = safeStorage.encryptString(url).toString("base64");
    }
    await mkdir(this.options.dataDir, { recursive: true });
    await writeFile(this.keyFile(), JSON.stringify(out), "utf8");
    this.publish();
    return this.getStatus();
  }

  private log(line: string): void {
    void appendFile(
      path.join(this.options.dataDir, "ps5-relay.log"),
      `${new Date().toISOString()} ${line}
`,
      "utf8",
    ).catch(() => undefined);
  }

  start(request: Ps5StartRequest): Ps5Status {
    if (this.relay || this.starting) return this.getStatus();
    this.lastRequest = request;
    this.userStopped = false;
    this.retries = 0;
    return this.launch(request);
  }

  private launch(request: Ps5StartRequest): Ps5Status {
    if (this.relay || this.starting) return this.getStatus();
    this.tempoNeedKey = true;
    this.log("session starting");
    const missing = this.missing();
    if (missing.length) {
      this.status = { ...this.blank(), lastError: `Missing: ${missing.join(", ")}` };
      this.publish();
      return this.getStatus();
    }
    this.starting = true;
    this.buffer = Buffer.alloc(0);
    this.headers = [];
    this.lastParams = null;
    this.status = {
      ...this.blank(),
      running: true,
      lastEvent: "Connecting to the PS5…",
    };
    const child = spawn(
      path.join(this.bin, "psrelay.exe"),
      [
        "stream",
        "--config",
        this.cfg,
        "--res",
        String(request.res),
        "--fps",
        String(request.fps),
        "--bitrate",
        String(Math.max(1000, Math.min(15000, Math.round(request.bitrateKbps)))),
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    this.relay = child;
    child.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    let errBuf = "";
    child.stderr.on("data", (chunk: Buffer) => {
      errBuf += chunk.toString("utf8");
      let nl: number;
      while ((nl = errBuf.indexOf("\n")) >= 0) {
        this.onRelayLine(errBuf.slice(0, nl).trim());
        errBuf = errBuf.slice(nl + 1);
      }
    });
    child.on("error", (error) => {
      this.status.lastError = error.message;
    });
    child.on("exit", (code) => {
      if (this.relay === child) this.relay = null;
      this.starting = false;
      this.log(`psrelay exited code=${code}`);
      const retry =
        this.autoReconnect && !this.userStopped && this.lastRequest !== null && this.retries < 30;
      if (!retry) this.endLive();
      this.status = {
        ...this.status,
        running: retry,
        proof: "unavailable",
        lastEvent: retry
          ? "PS5 session ended. Reconnecting…"
          : code === 0 || code === null
            ? "Stopped."
            : `PS5 session ended (code ${code}).`,
      };
      if (!retry) this.status.videoKbps = 0;
      this.publish();
      if (retry) {
        this.retries++;
        const wait = Math.min(15000, 3000 + this.retries * 1000);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (!this.userStopped && this.lastRequest) this.launch(this.lastRequest);
        }, wait);
      }
    });
    this.publish();
    return this.getStatus();
  }

  /** 15-byte controller frame on psrelay's stdin: 0xC7, u32 buttons, u8 l2, u8 r2, i16 lx ly rx ry. */
  sendPad(state: Ps5PadState): void {
    const stdin = this.relay?.stdin;
    if (!stdin || stdin.destroyed || !stdin.writable) return;
    const clamp = (v: unknown, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
    const frame = Buffer.alloc(15);
    frame[0] = 0xc7;
    frame.writeUInt32LE((Number(state.buttons) >>> 0) & 0xffff, 1);
    frame[5] = clamp(state.l2, 0, 255);
    frame[6] = clamp(state.r2, 0, 255);
    frame.writeInt16LE(clamp(state.lx, -32768, 32767), 7);
    frame.writeInt16LE(clamp(state.ly, -32768, 32767), 9);
    frame.writeInt16LE(clamp(state.rx, -32768, 32767), 11);
    frame.writeInt16LE(clamp(state.ry, -32768, 32767), 13);
    stdin.write(frame);
  }

  setAutoReconnect(on: boolean): void {
    this.autoReconnect = on;
    this.log(`auto-reconnect ${on ? "on" : "off"}`);
    if (!on && this.reconnectTimer) {
      // a reconnect was already waiting: cancel it and end the run
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.endLive();
      this.status = { ...this.status, running: false, lastEvent: "Reconnect cancelled." };
      this.publish();
    }
  }

  stop(): Ps5Status {
    this.userStopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.status = { ...this.status, running: false, lastEvent: "Stopped." };
      this.publish();
    }
    this.endLive();
    const child = this.relay;
    if (child) {
      // psrelay stops when its stdin closes.
      child.stdin?.end();
      setTimeout(() => {
        if (this.relay === child && !child.killed) child.kill();
      }, 4000).unref();
    }
    return this.getStatus();
  }

  private onRelayLine(line: string): void {
    if (!line.startsWith("{")) return;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const name = String(event.event ?? "");
      if (name !== "video_diag" && name !== "audio_diag" && name !== "video_first_frames") {
        this.log(`${name} ${String(event.detail ?? "")}`);
      }
      if (name === "error" || name === "quit" || name === "login_pin_requested") {
        this.status.lastError = `${name === "quit" ? "PS5 ended the session" : name}: ${String(event.detail ?? "")}`;
      }
      if (name === "connected") {
        this.retries = 0;
        this.status.lastError = "";
      }
      this.status.lastEvent = name || this.status.lastEvent;
      this.publish(false);
    } catch {
      // not JSON
    }
  }

  private onTempoLine(line: string): void {
    if (!line.startsWith("{")) return;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const name = String(event.event ?? "");
      if (name === "stats") {
        this.status.videoKbps = Number(event.video_kbps ?? 0);
        const dests =
          (event.dests as Array<{ state?: string; queued_kb?: number; dropped?: number }>) ?? [];
        let dropped = 0;
        dests.forEach((d, i) => {
          const platform = this.liveOrder[i];
          if (platform)
            this.destState.set(
              platform,
              d.state === "live" ? "live" : d.state === "error" ? "error" : "idle",
            );
          dropped += Number(d.dropped ?? 0);
        });
        this.status.droppedKb = dropped;
      } else if (name === "dest_error") {
        this.status.lastError = "A destination reported an error; it will retry on its own.";
      }
      this.publish(false);
    } catch {
      // not JSON
    }
  }

  private onData(chunk: Buffer): void {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (;;) {
      if (this.buffer.length < 16) return;
      const type = this.buffer[0];
      const flags = this.buffer[1];
      const length = this.buffer.readUInt32LE(4);
      if (this.buffer.length < 16 + length) return;
      const packet = this.buffer.subarray(0, 16 + length);
      this.buffer = this.buffer.subarray(16 + length);
      this.onPacket(type, flags, packet);
    }
  }

  private onPacket(type: number, flags: number, packet: Buffer): void {
    const payload = packet.subarray(16);
    if (type === 4 && payload.length >= 7) {
      this.status.width = payload.readUInt16LE(1);
      this.status.height = payload.readUInt16LE(3);
      this.status.fps = payload.readUInt16LE(5);
      this.headers[1] = Buffer.from(packet);
    } else if (type === 3) {
      this.headers[0] = Buffer.from(packet);
    } else if (type === 1) {
      const key = (flags & 1) !== 0;
      if (this.status.proof !== "real") {
        this.status.proof = "real";
        this.status.lastEvent = "PS5 video is flowing.";
        this.publish();
      }
      if (!key && payload.length < 512) this.lastParams = Buffer.from(packet);
      this.options.publishVideo({
        key,
        lost: (flags & 2) !== 0,
        ts: Number(packet.readBigUInt64LE(8)),
        data: new Uint8Array(payload),
      });
    }
    if (type === 5) this.options.publishAudio(new Uint8Array(payload));
    if (!this.composited) this.feedTempo(type, flags, packet);
  }

  private writeOut(type: number, flags: number, tsUs: number, data: Uint8Array): void {
    const stdin = this.tempo?.stdin;
    if (!this.composited || !stdin || stdin.destroyed) return;
    if (stdin.writableLength > 8 * 1024 * 1024) return; // sender is behind: drop rather than build delay
    const head = Buffer.alloc(16);
    head[0] = type;
    head[1] = flags;
    head.writeUInt32LE(data.length, 4);
    // one clock for audio and video: stamp both on arrival here (the sender smooths the jitter)
    void tsUs;
    head.writeBigUInt64LE(process.hrtime.bigint() / 1000n, 8);
    stdin.write(head);
    stdin.write(data);
  }

  feedOutVideo(packet: { key: boolean; ts: number; data: Uint8Array }): void {
    this.writeOut(1, packet.key ? 1 : 0, packet.ts, packet.data);
  }

  feedOutAudio(pcm: Uint8Array): void {
    this.writeOut(5, 0, Date.now() * 1000, pcm);
  }

  private feedTempo(type: number, flags: number, packet: Buffer): void {
    const tempo = this.tempo;
    if (!tempo || !tempo.stdin || tempo.stdin.destroyed) return;
    if (type === 1) {
      const key = (flags & 1) !== 0;
      if (this.tempoNeedKey) {
        if (!key) return;
        if (this.lastParams) tempo.stdin.write(this.lastParams);
        this.tempoNeedKey = false;
      } else if (tempo.stdin.writableLength > 8 * 1024 * 1024) {
        this.tempoNeedKey = true; // fell behind: skip to the next keyframe
        return;
      }
    } else if (this.tempoNeedKey && type === 5) {
      return; // audio before the first keyframe would start ahead of the video
    }
    tempo.stdin.write(packet);
  }

  goLive(platforms: Ps5Platform[], options?: Ps5LiveOptions): Ps5Status {
    const composited = options?.mode === "composited";
    if (!composited && !this.relay) throw new Error("Start the PS5 session first.");
    if (this.tempo) return this.getStatus();
    const chosen = platforms.filter((platform) => this.keys.has(platform));
    if (!chosen.length) throw new Error("Add a stream key for at least one destination first.");
    this.liveOrder = chosen;
    chosen.forEach((platform) => this.destState.set(platform, "idle"));
    const urls = chosen.map((platform) => this.keys.get(platform)!).join("\n");
    const child = spawn(path.join(this.bin, "tempo-rtmp.exe"), [], {
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
      env: { ...process.env, TEMPO_RTMP_DESTS: urls },
    });
    this.tempo = child;
    this.composited = composited;
    this.tempoNeedKey = true;
    let errBuf = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      errBuf += chunk.toString("utf8");
      let nl: number;
      while ((nl = errBuf.indexOf("\n")) >= 0) {
        this.onTempoLine(errBuf.slice(0, nl).trim());
        errBuf = errBuf.slice(nl + 1);
      }
    });
    child.stdin?.on("error", () => undefined);
    child.on("error", (error) => {
      this.status.lastError = error.message;
    });
    child.on("exit", () => {
      if (this.tempo === child) {
        this.tempo = null;
        this.composited = false;
      }
      chosen.forEach((platform) => this.destState.set(platform, "idle"));
      this.status.videoKbps = 0;
      this.publish();
    });
    if (composited) {
      const info = Buffer.alloc(16 + 7);
      info[0] = 4;
      info.writeUInt32LE(7, 4);
      info[16] = 0; // H.264
      info.writeUInt16LE(options?.width ?? 1280, 17);
      info.writeUInt16LE(options?.height ?? 720, 19);
      info.writeUInt16LE(options?.fps ?? 30, 21);
      const audio = Buffer.alloc(16 + 10);
      audio[0] = 3;
      audio.writeUInt32LE(10, 4);
      audio[16] = 2;
      audio[17] = 16;
      audio.writeUInt32LE(48000, 18);
      audio.writeUInt32LE(480, 22);
      child.stdin?.write(audio);
      child.stdin?.write(info);
    } else {
      for (const header of this.headers) if (header) child.stdin?.write(header);
    }
    this.publish();
    return this.getStatus();
  }

  endLive(): Ps5Status {
    const child = this.tempo;
    if (child) {
      child.stdin?.end();
      setTimeout(() => {
        if (!child.killed && this.tempo === child) child.kill();
      }, 4000).unref();
    }
    return this.getStatus();
  }

  dispose(): void {
    this.stop();
  }
}
