import type { Ps5PadState, Ps5VideoPacket } from "../../shared/contracts";
import { getBridge } from "../bridge";

const bridge = getBridge();

/* ------------------------------------------------------------------ scene model */

export type LayerKind =
  "ps5" | "camera" | "text" | "image" | "chat" | "alert" | "counter" | "screen";

export interface Layer {
  id: string;
  kind: LayerKind;
  name: string;
  /** Position and size as fractions of the canvas (0..1). */
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  fit: "cover" | "contain" | "stretch";
  mirror?: boolean;
  /** Camera look: window shape, zoom into the picture, nudge it, colour, and an outline. */
  cam?: CameraLook;
  text?: {
    value: string;
    size: number;
    color: string;
    bold: boolean;
    outline: boolean;
    align: "left" | "center" | "right";
  };
  /** data: URL for image layers */
  image?: string;
  /** A screen or window on this PC. The id only lasts while the app runs; the name finds it again. */
  screen?: { sourceId: string; name: string; kind: "screen" | "window" };
  /** Live chat from the connected Twitch channel: how many lines, text size, seconds before a line fades (0 = stay). */
  chat?: { lines: number; size: number; fadeSec: number };
  /** Pop-up banner for sub / raid alerts (and the Test alert button). */
  alert?: { size: number; seconds: number; color: string };
  /** A number you change with the buttons, e.g. deaths or wins. */
  counter?: { label: string; value: number; size: number; color: string };
}

/* ------------------------------------------------------------------ chat + alerts feed */

export interface ChatLine {
  id: string;
  user: string;
  color: string;
  text: string;
  at: number;
}
export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  at: number;
}

/** Messages and alerts that overlay layers read every frame. Lives for the whole app run. */
export const chatFeed = {
  lines: [] as ChatLine[],
  alerts: [] as AlertItem[],
  pushLine(line: Omit<ChatLine, "at">): void {
    this.lines.push({ ...line, at: performance.now() });
    if (this.lines.length > 60) this.lines.splice(0, this.lines.length - 60);
  },
  pushAlert(item: Omit<AlertItem, "at">): void {
    this.alerts.push({ ...item, at: performance.now() });
    if (this.alerts.length > 20) this.alerts.splice(0, this.alerts.length - 20);
  },
};

export interface CameraLook {
  shape: "rect" | "rounded" | "circle";
  /** 1 = whole picture, up to 3 = zoomed in */
  zoom: number;
  /** -1..1 shift of the zoomed window */
  shiftX: number;
  shiftY: number;
  brightness: number;
  contrast: number;
  saturation: number;
  borderWidth: number;
  borderColor: string;
}

export function defaultCameraLook(): CameraLook {
  return {
    shape: "rect",
    zoom: 1,
    shiftX: 0,
    shiftY: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    borderWidth: 0,
    borderColor: "#d8ff3e",
  };
}

/** Audio that belongs to one scene. Anything left out follows the main mixer. */
export interface SceneAudio {
  micMuted?: boolean;
  ps5Muted?: boolean;
  /** A song kept in this PC's browser storage (see putSong). */
  song?: { id: string; name: string; volume: number; loop: boolean } | null;
}

export interface Scene {
  id: string;
  name: string;
  layers: Layer[];
  audio?: SceneAudio;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeLayer(kind: LayerKind, extra: Partial<Layer> = {}): Layer {
  const base: Layer = {
    id: uid(),
    kind,
    name: {
      ps5: "PS5",
      camera: "Camera",
      text: "Text",
      image: "Image",
      chat: "Chat",
      alert: "Alerts",
      counter: "Counter",
      screen: "Screen",
    }[kind],
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    opacity: 1,
    visible: true,
    fit: kind === "ps5" || kind === "screen" ? "contain" : "cover",
  };
  if (kind === "camera")
    Object.assign(base, {
      x: 0.74,
      y: 0.62,
      w: 0.24,
      h: 0.34,
      mirror: true,
      cam: defaultCameraLook(),
    });
  if (kind === "text") {
    Object.assign(base, {
      x: 0.05,
      y: 0.05,
      w: 0.5,
      h: 0.12,
      text: {
        value: "Live now",
        size: 64,
        color: "#ffffff",
        bold: true,
        outline: true,
        align: "left",
      },
    });
  }
  if (kind === "image") Object.assign(base, { x: 0.04, y: 0.04, w: 0.18, h: 0.18, fit: "contain" });
  if (kind === "chat")
    Object.assign(base, {
      x: 0.02,
      y: 0.45,
      w: 0.3,
      h: 0.5,
      chat: { lines: 8, size: 26, fadeSec: 45 },
    });
  if (kind === "alert")
    Object.assign(base, {
      x: 0.25,
      y: 0.06,
      w: 0.5,
      h: 0.14,
      alert: { size: 40, seconds: 6, color: "#d8ff3e" },
    });
  if (kind === "counter")
    Object.assign(base, {
      x: 0.78,
      y: 0.04,
      w: 0.19,
      h: 0.1,
      counter: { label: "Wins", value: 0, size: 44, color: "#ffffff" },
    });
  return { ...base, ...extra };
}

export function defaultScenes(): Scene[] {
  return [
    {
      id: uid(),
      name: "Game",
      layers: [makeLayer("ps5"), makeLayer("camera")],
    },
    {
      id: uid(),
      name: "Game full",
      layers: [makeLayer("ps5")],
    },
    {
      id: uid(),
      name: "Starting soon",
      layers: [
        makeLayer("camera", { x: 0.25, y: 0.12, w: 0.5, h: 0.7, mirror: true }),
        makeLayer("text", {
          name: "Title",
          x: 0.1,
          y: 0.84,
          w: 0.8,
          h: 0.12,
          text: {
            value: "Starting soon",
            size: 78,
            color: "#d8ff3e",
            bold: true,
            outline: true,
            align: "center",
          },
        }),
      ],
    },
    {
      id: uid(),
      name: "Be right back",
      audio: { micMuted: true },
      layers: [
        makeLayer("text", {
          name: "Title",
          x: 0.1,
          y: 0.4,
          w: 0.8,
          h: 0.2,
          text: {
            value: "Be right back",
            size: 110,
            color: "#ffffff",
            bold: true,
            outline: false,
            align: "center",
          },
        }),
      ],
    },
  ];
}

/* ------------------------------------------------------------------ PS5 feed (video decode + audio ring) */

function scanNals(data: Uint8Array): Array<{ type: number; start: number }> {
  const out: Array<{ type: number; start: number }> = [];
  for (let i = 0; i + 3 < data.length; i++) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
      out.push({ type: data[i + 3] & 0x1f, start: i + 3 });
      i += 3;
    }
  }
  return out;
}

export class Ps5Feed {
  frame: VideoFrame | null = null;
  frames = 0;
  error = "";
  lastFrameAt = 0;
  private decoder: VideoDecoder | null = null;
  private codec = "";
  private needKey = true;
  private pending: Uint8Array | null = null;
  private offVideo: (() => void) | null = null;
  private offAudio: (() => void) | null = null;
  // audio ring (interleaved stereo float)
  private ring = new Float32Array(48000 * 2 * 2);
  private head = 0;
  private tail = 0;
  private fill = 0;

  start(): void {
    if (this.offVideo) return;
    if (typeof VideoDecoder === "undefined") {
      this.error = "This window cannot decode video (WebCodecs is missing).";
      return;
    }
    this.offVideo = bridge.subscribePs5Video((p) => this.onVideo(p));
    this.offAudio = bridge.subscribePs5Audio((pcm) => this.onAudio(pcm));
  }

  stop(): void {
    this.offVideo?.();
    this.offAudio?.();
    this.offVideo = this.offAudio = null;
    if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
    this.decoder = null;
    this.codec = "";
    this.frame?.close();
    this.frame = null;
    this.fill = this.head = this.tail = 0;
  }

  get live(): boolean {
    return this.frame !== null && performance.now() - this.lastFrameAt < 2000;
  }

  get size(): { width: number; height: number } {
    return { width: this.frame?.displayWidth ?? 0, height: this.frame?.displayHeight ?? 0 };
  }

  private make(codec: string): void {
    this.decoder?.close();
    this.codec = codec;
    this.decoder = new VideoDecoder({
      output: (f) => {
        this.frame?.close();
        this.frame = f;
        this.frames++;
        this.lastFrameAt = performance.now();
      },
      error: (e) => {
        this.error = `Decoder stopped: ${e.message}`;
        this.needKey = true;
      },
    });
    this.decoder.configure({
      codec,
      optimizeForLatency: true,
      hardwareAcceleration: "prefer-hardware",
      // @ts-expect-error avc.format is part of WebCodecs but missing from some lib.dom versions
      avc: { format: "annexb" },
    });
    this.needKey = true;
  }

  private onVideo(packet: Ps5VideoPacket): void {
    const nals = scanNals(packet.data);
    const hasSlice = nals.some((n) => n.type === 1 || n.type === 5);
    if (!hasSlice) {
      this.pending = packet.data;
      const sps = nals.find((n) => n.type === 7);
      if (sps && sps.start + 3 < packet.data.length) {
        const hex = (b: number) => b.toString(16).padStart(2, "0");
        const codec = `avc1.${hex(packet.data[sps.start + 1])}${hex(packet.data[sps.start + 2])}${hex(packet.data[sps.start + 3])}`;
        if (codec !== this.codec) this.make(codec);
      }
      return;
    }
    const decoder = this.decoder;
    if (!decoder || decoder.state === "closed") return;
    let data = packet.data;
    if (this.pending) {
      const joined = new Uint8Array(this.pending.length + data.length);
      joined.set(this.pending, 0);
      joined.set(data, this.pending.length);
      data = joined;
      this.pending = null;
    }
    const isKey = packet.key || nals.some((n) => n.type === 5);
    if (this.needKey) {
      if (!isKey) return;
      this.needKey = false;
    }
    if (decoder.decodeQueueSize > 8 && !isKey) return;
    try {
      decoder.decode(
        new EncodedVideoChunk({ type: isKey ? "key" : "delta", timestamp: packet.ts, data }),
      );
    } catch (e) {
      this.needKey = true;
      this.error = e instanceof Error ? e.message : "Decode failed.";
    }
  }

  private onAudio(bytes: Uint8Array): void {
    const samples = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2),
    );
    for (let i = 0; i < samples.length; i++) {
      if (this.fill >= this.ring.length) {
        this.tail = (this.tail + 1) % this.ring.length; // overrun: drop oldest
        this.fill--;
      }
      this.ring[this.head] = samples[i] / 32768;
      this.head = (this.head + 1) % this.ring.length;
      this.fill++;
    }
  }

  /** Fill interleaved stereo output; underruns are silence. */
  readAudio(out: Float32Array): void {
    // keep latency bounded: if more than 200 ms is queued, skip ahead
    const maxFill = 48000 * 2 * 0.2;
    if (this.fill > maxFill) {
      const drop = this.fill - Math.round(maxFill / 2);
      this.tail = (this.tail + drop) % this.ring.length;
      this.fill -= drop;
    }
    for (let i = 0; i < out.length; i++) {
      if (this.fill > 0) {
        out[i] = this.ring[this.tail];
        this.tail = (this.tail + 1) % this.ring.length;
        this.fill--;
      } else {
        out[i] = 0;
      }
    }
  }
}

/* ------------------------------------------------------------------ compositor */

/** Twitch lets viewers pick very dark name colours; lift them so they read on a dark stream. */
function readableColor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#d8ff3e";
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum < 110) {
    const lift = (110 - lum) / (255 - lum);
    r = Math.round(r + (255 - r) * lift);
    g = Math.round(g + (255 - g) * lift);
    b = Math.round(b + (255 - b) * lift);
  }
  return `rgb(${r},${g},${b})`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

export class Compositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private images = new Map<string, HTMLImageElement>();
  camera: HTMLVideoElement | null = null;
  /** Playing screen / window captures, by layer id. */
  screens = new Map<string, HTMLVideoElement>();
  scene: Scene | null = null;
  /** Burn this PC's clock into the picture so the delay on a platform can be read off. */
  clock = false;

  constructor(
    private feed: Ps5Feed,
    width = 1280,
    height = 720,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
  }

  resize(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  private image(layer: Layer): HTMLImageElement | null {
    if (!layer.image) return null;
    let img = this.images.get(layer.id + layer.image.length);
    if (!img) {
      img = new Image();
      img.src = layer.image;
      this.images.set(layer.id + layer.image.length, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  private place(
    source: { w: number; h: number },
    box: { x: number; y: number; w: number; h: number },
    fit: Layer["fit"],
  ) {
    if (fit === "stretch" || !source.w || !source.h) {
      return {
        sx: 0,
        sy: 0,
        sw: source.w,
        sh: source.h,
        dx: box.x,
        dy: box.y,
        dw: box.w,
        dh: box.h,
      };
    }
    const sourceRatio = source.w / source.h;
    const boxRatio = box.w / box.h;
    if (fit === "contain") {
      const dw = sourceRatio > boxRatio ? box.w : box.h * sourceRatio;
      const dh = sourceRatio > boxRatio ? box.w / sourceRatio : box.h;
      return {
        sx: 0,
        sy: 0,
        sw: source.w,
        sh: source.h,
        dx: box.x + (box.w - dw) / 2,
        dy: box.y + (box.h - dh) / 2,
        dw,
        dh,
      };
    }
    // cover: crop the source to the box ratio
    const sw = sourceRatio > boxRatio ? source.h * boxRatio : source.w;
    const sh = sourceRatio > boxRatio ? source.h : source.w / boxRatio;
    return {
      sx: (source.w - sw) / 2,
      sy: (source.h - sh) / 2,
      sw,
      sh,
      dx: box.x,
      dy: box.y,
      dw: box.w,
      dh: box.h,
    };
  }

  private drawCamera(
    v: HTMLVideoElement,
    layer: Layer,
    box: { x: number; y: number; w: number; h: number },
  ): void {
    const { ctx } = this;
    const look = { ...defaultCameraLook(), ...layer.cam };
    const p = this.place({ w: v.videoWidth, h: v.videoHeight }, box, layer.fit);
    // zoom: look at a smaller window of the picture, moved by the shift
    let { sx, sy, sw, sh } = p;
    if (look.zoom > 1) {
      const zw = sw / look.zoom;
      const zh = sh / look.zoom;
      sx += (sw - zw) / 2 + (look.shiftX * (sw - zw)) / 2;
      sy += (sh - zh) / 2 + (look.shiftY * (sh - zh)) / 2;
      sw = zw;
      sh = zh;
    }
    ctx.save();
    // the window the picture shows through
    const radius =
      look.shape === "circle"
        ? Math.min(p.dw, p.dh) / 2
        : look.shape === "rounded"
          ? Math.min(p.dw, p.dh) * 0.12
          : 0;
    const path = new Path2D();
    if (look.shape === "circle") {
      const side = Math.min(p.dw, p.dh);
      path.roundRect(p.dx + (p.dw - side) / 2, p.dy + (p.dh - side) / 2, side, side, radius);
    } else {
      path.roundRect(p.dx, p.dy, p.dw, p.dh, radius);
    }
    ctx.clip(path);
    if (look.brightness !== 1 || look.contrast !== 1 || look.saturation !== 1) {
      ctx.filter = `brightness(${look.brightness}) contrast(${look.contrast}) saturate(${look.saturation})`;
    }
    if (look.shape === "circle") {
      // a square crop from the middle so the circle is not stretched
      const side = Math.min(sw, sh);
      sx += (sw - side) / 2;
      sy += (sh - side) / 2;
      sw = sh = side;
    }
    const dx = look.shape === "circle" ? p.dx + (p.dw - Math.min(p.dw, p.dh)) / 2 : p.dx;
    const dy = look.shape === "circle" ? p.dy + (p.dh - Math.min(p.dw, p.dh)) / 2 : p.dy;
    const dw = look.shape === "circle" ? Math.min(p.dw, p.dh) : p.dw;
    const dh = look.shape === "circle" ? Math.min(p.dw, p.dh) : p.dh;
    if (layer.mirror) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, dw, dh);
    } else {
      ctx.drawImage(v, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.restore();
    if (look.borderWidth > 0) {
      ctx.save();
      ctx.lineWidth = look.borderWidth * (this.canvas.height / 720);
      ctx.strokeStyle = look.borderColor;
      ctx.stroke(path);
      ctx.restore();
    }
  }

  private drawChat(layer: Layer, box: { x: number; y: number; w: number; h: number }): void {
    const { ctx } = this;
    const cfg = layer.chat!;
    const size = cfg.size * (this.canvas.height / 720);
    const now = performance.now();
    ctx.font = `600 ${size}px "Segoe UI", system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";
    // wrap each line, newest at the bottom
    const rows: Array<{
      user: string;
      color: string;
      text: string;
      first: boolean;
      alpha: number;
    }> = [];
    for (const m of chatFeed.lines.slice(-cfg.lines)) {
      const age = (now - m.at) / 1000;
      if (cfg.fadeSec > 0 && age > cfg.fadeSec) continue;
      const alpha = cfg.fadeSec > 0 ? Math.max(0, Math.min(1, (cfg.fadeSec - age) / 3)) : 1;
      const prefix = `${m.user}: `;
      const lead = ctx.measureText(prefix).width;
      const wrapped = wrapLines(ctx, m.text, Math.max(40, box.w - lead));
      wrapped.forEach((text, i) =>
        rows.push({
          user: i === 0 ? m.user : "",
          color: m.color || "#d8ff3e",
          text,
          first: i === 0,
          alpha,
        }),
      );
    }
    const lineH = size * 1.2;
    const fit = Math.max(1, Math.floor(box.h / lineH));
    const shown = rows.slice(-fit);
    let y = box.y + box.h - shown.length * lineH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    for (const row of shown) {
      ctx.globalAlpha = layer.opacity * row.alpha;
      let x = box.x;
      if (row.first) {
        const name = `${row.user}: `;
        ctx.lineWidth = Math.max(2, size / 8);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(name, x, y);
        ctx.fillStyle = readableColor(row.color);
        ctx.fillText(name, x, y);
        x += ctx.measureText(name).width;
      } else {
        x += ctx.measureText("  ").width;
      }
      ctx.lineWidth = Math.max(2, size / 8);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(row.text, x, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(row.text, x, y);
      y += lineH;
    }
    ctx.restore();
  }

  private drawAlert(layer: Layer, box: { x: number; y: number; w: number; h: number }): void {
    const { ctx } = this;
    const cfg = layer.alert!;
    const now = performance.now();
    const item = [...chatFeed.alerts].reverse().find((a) => now - a.at < cfg.seconds * 1000);
    if (!item) return;
    const age = (now - item.at) / 1000;
    const inT = Math.min(1, age / 0.35);
    const outT = Math.min(1, Math.max(0, (cfg.seconds - age) / 0.5));
    const ease = 1 - Math.pow(1 - inT, 3);
    const size = cfg.size * (this.canvas.height / 720);
    ctx.save();
    ctx.globalAlpha = layer.opacity * outT;
    const slide = (1 - ease) * -box.h;
    ctx.translate(0, slide);
    ctx.fillStyle = "rgba(8,10,13,0.88)";
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = cfg.color;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = cfg.color;
    ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(
      item.title,
      box.x + box.w / 2,
      box.y + box.h * (item.detail ? 0.38 : 0.5),
      box.w - 24,
    );
    if (item.detail) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${size * 0.62}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(item.detail, box.x + box.w / 2, box.y + box.h * 0.74, box.w - 24);
    }
    ctx.restore();
  }

  draw(): void {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#050607";
    ctx.fillRect(0, 0, W, H);
    for (const layer of this.scene?.layers ?? []) {
      if (!layer.visible) continue;
      const box = { x: layer.x * W, y: layer.y * H, w: layer.w * W, h: layer.h * H };
      ctx.globalAlpha = layer.opacity;
      if (layer.kind === "ps5") {
        const f = this.feed.frame;
        if (f) {
          const p = this.place({ w: f.displayWidth, h: f.displayHeight }, box, layer.fit);
          ctx.drawImage(f, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
        }
      } else if (layer.kind === "camera") {
        const v = this.camera;
        if (v && v.readyState >= 2 && v.videoWidth) this.drawCamera(v, layer, box);
      } else if (layer.kind === "image") {
        const img = this.image(layer);
        if (img) {
          const p = this.place({ w: img.naturalWidth, h: img.naturalHeight }, box, layer.fit);
          ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
        }
      } else if (layer.kind === "screen") {
        const v = this.screens.get(layer.id);
        if (v && v.readyState >= 2 && v.videoWidth) {
          const p = this.place({ w: v.videoWidth, h: v.videoHeight }, box, layer.fit);
          ctx.drawImage(v, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
        }
      } else if (layer.kind === "chat" && layer.chat) {
        this.drawChat(layer, box);
      } else if (layer.kind === "alert" && layer.alert) {
        this.drawAlert(layer, box);
      } else if (layer.kind === "counter" && layer.counter) {
        const c = layer.counter;
        const size = c.size * (H / 720);
        ctx.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        const label = `${c.label}  ${c.value}`;
        const pad = size * 0.4;
        const width = Math.min(box.w, ctx.measureText(label).width + pad * 2);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.beginPath();
        ctx.roundRect(box.x + (box.w - width) / 2, box.y, width, size + pad, 12);
        ctx.fill();
        ctx.fillStyle = c.color;
        ctx.fillText(label, box.x + box.w / 2, box.y + (size + pad) / 2);
      } else if (layer.kind === "text" && layer.text) {
        const t = layer.text;
        const size = t.size * (H / 720);
        ctx.font = `${t.bold ? "700" : "400"} ${size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textBaseline = "top";
        ctx.textAlign = t.align;
        const lines = wrapLines(ctx, t.value, box.w);
        const tx =
          t.align === "left" ? box.x : t.align === "center" ? box.x + box.w / 2 : box.x + box.w;
        lines.forEach((line, i) => {
          const ty = box.y + i * size * 1.15;
          if (t.outline) {
            ctx.lineJoin = "round";
            ctx.lineWidth = Math.max(2, size / 9);
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.strokeText(line, tx, ty);
          }
          ctx.fillStyle = t.color;
          ctx.fillText(line, tx, ty);
        });
      }
    }
    ctx.globalAlpha = 1;
    if (this.clock) {
      const size = Math.round(H / 14);
      const stamp = new Date().toLocaleTimeString([], { hour12: false });
      ctx.font = `700 ${size}px "Consolas", monospace`;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      const pad = size * 0.3;
      const width = ctx.measureText(stamp).width;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(pad, H - size - pad * 2.5, width + pad * 2, size + pad * 1.5);
      ctx.fillStyle = "#d8ff3e";
      ctx.fillText(stamp, pad * 2, H - pad * 1.75);
    }
  }
}

/* ------------------------------------------------------------------ camera + mic */

export interface MediaChoice {
  id: string;
  label: string;
}

export async function listDevices(): Promise<{ cameras: MediaChoice[]; mics: MediaChoice[] }> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const pick = (kind: MediaDeviceKind) =>
    devices
      .filter((d) => d.kind === kind)
      .map((d, i) => ({
        id: d.deviceId,
        label: d.label || `${kind === "videoinput" ? "Camera" : "Microphone"} ${i + 1}`,
      }));
  return { cameras: pick("videoinput"), mics: pick("audioinput") };
}

/* ------------------------------------------------------------------ audio mixer */

export class Mixer {
  readonly ctx: AudioContext;
  private ps5Node: ScriptProcessorNode;
  private ps5Gain: GainNode;
  private ps5Analyser: AnalyserNode;
  private micGain: GainNode;
  private micAnalyser: AnalyserNode;
  private bus: GainNode;
  private monitor: GainNode;
  private capture: ScriptProcessorNode;
  private songGain: GainNode;
  private songAnalyser: AnalyserNode;
  private song: { el: HTMLAudioElement; url: string; id: string } | null = null;
  private ps5Volume = 1;
  private micVolume = 1;
  private ps5Muted = false;
  private micMuted = false;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  onPcm: ((pcm: Int16Array) => void) | null = null;
  private scratch = new Float32Array(2048);

  constructor(feed: Ps5Feed) {
    this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
    this.ps5Node = this.ctx.createScriptProcessor(2048, 0, 2);
    this.ps5Node.onaudioprocess = (e) => {
      const frames = e.outputBuffer.length;
      if (this.scratch.length < frames * 2) this.scratch = new Float32Array(frames * 2);
      const view = this.scratch.subarray(0, frames * 2);
      feed.readAudio(view);
      const l = e.outputBuffer.getChannelData(0);
      const r = e.outputBuffer.getChannelData(1);
      for (let i = 0; i < frames; i++) {
        l[i] = view[i * 2];
        r[i] = view[i * 2 + 1];
      }
    };
    this.ps5Gain = this.ctx.createGain();
    this.ps5Analyser = this.ctx.createAnalyser();
    this.ps5Analyser.fftSize = 1024;
    this.micGain = this.ctx.createGain();
    this.micAnalyser = this.ctx.createAnalyser();
    this.micAnalyser.fftSize = 1024;
    this.bus = this.ctx.createGain();
    this.songGain = this.ctx.createGain();
    this.songAnalyser = this.ctx.createAnalyser();
    this.songAnalyser.fftSize = 1024;
    this.monitor = this.ctx.createGain();
    this.monitor.gain.value = 0;
    this.ps5Node.connect(this.ps5Gain);
    this.ps5Gain.connect(this.ps5Analyser);
    this.ps5Gain.connect(this.bus);
    this.ps5Gain.connect(this.monitor);
    this.monitor.connect(this.ctx.destination);
    this.songGain.connect(this.songAnalyser);
    this.songGain.connect(this.bus);
    this.songGain.connect(this.monitor);
    this.micGain.connect(this.micAnalyser);
    this.micGain.connect(this.bus);
    // stereo capture of the program mix; its output is silent but must be connected to keep running
    this.capture = this.ctx.createScriptProcessor(2048, 2, 2);
    this.capture.onaudioprocess = (e) => {
      const frames = e.inputBuffer.length;
      const l = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      for (let c = 0; c < e.outputBuffer.numberOfChannels; c++)
        e.outputBuffer.getChannelData(c).fill(0);
      const handler = this.onPcm;
      if (!handler) return;
      const out = new Int16Array(frames * 2);
      for (let i = 0; i < frames; i++) {
        out[i * 2] = Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767)));
        out[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767)));
      }
      handler(out);
    };
    this.bus.connect(this.capture);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.capture.connect(mute);
    mute.connect(this.ctx.destination);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  private applyGains(): void {
    // short ramps so a mute or scene change never clicks
    const t = this.ctx.currentTime;
    this.ps5Gain.gain.setTargetAtTime(this.ps5Muted ? 0 : this.ps5Volume, t, 0.03);
    this.micGain.gain.setTargetAtTime(this.micMuted ? 0 : this.micVolume, t, 0.03);
  }
  setPs5Volume(v: number): void {
    this.ps5Volume = v;
    this.applyGains();
  }
  setMicVolume(v: number): void {
    this.micVolume = v;
    this.applyGains();
  }
  /** Scene-level mutes: the sliders keep their place, the sound just stops. */
  setMutes(ps5: boolean, mic: boolean): void {
    this.ps5Muted = ps5;
    this.micMuted = mic;
    this.applyGains();
  }

  /** Plays a song through the stream mix. Same id again only updates volume and loop. */
  async playSong(id: string, blob: Blob, volume: number, loop: boolean): Promise<void> {
    if (this.song?.id === id) {
      this.song.el.loop = loop;
      this.setSongVolume(volume);
      if (this.song.el.paused) await this.song.el.play();
      return;
    }
    this.stopSong();
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.loop = loop;
    this.song = { el, url, id };
    this.ctx.createMediaElementSource(el).connect(this.songGain);
    this.songGain.gain.value = 0;
    await el.play();
    this.songGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.4); // fade in
  }
  setSongVolume(v: number): void {
    this.songGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  stopSong(): void {
    const song = this.song;
    if (!song) return;
    this.song = null;
    this.songGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25); // fade out
    window.setTimeout(() => {
      song.el.pause();
      song.el.removeAttribute("src");
      URL.revokeObjectURL(song.url);
    }, 900);
  }
  get songId(): string | null {
    return this.song?.id ?? null;
  }
  songDb(): number {
    return this.level(this.songAnalyser);
  }
  setMonitor(on: boolean): void {
    this.monitor.gain.value = on ? 1 : 0;
  }

  async setMic(deviceId: string | null): Promise<void> {
    this.micSource?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micSource = null;
    this.micStream = null;
    if (!deviceId) return;
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    const attempts: MediaTrackConstraints[] = [
      {
        ...base,
        deviceId: deviceId === "default" ? undefined : { exact: deviceId },
        channelCount: 1,
      },
      { ...base, deviceId: deviceId === "default" ? undefined : { exact: deviceId } },
      { ...base },
    ];
    let last: unknown = null;
    for (const audio of attempts) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio });
        break;
      } catch (e) {
        last = e;
      }
    }
    if (!this.micStream) {
      const err = last as DOMException | null;
      throw new Error(`${err?.name ?? "Error"}${err?.message ? ` - ${err.message}` : ""}`);
    }
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    this.micSource.connect(this.micGain);
  }

  private level(analyser: AnalyserNode): number {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    return peak <= 0.00001 ? -90 : 20 * Math.log10(peak);
  }
  ps5Db(): number {
    return this.level(this.ps5Analyser);
  }
  micDb(): number {
    return this.level(this.micAnalyser);
  }

  dispose(): void {
    this.stopSong();
    this.micStream?.getTracks().forEach((t) => t.stop());
    void this.ctx.close();
  }
}

/* ------------------------------------------------------------------ program encoder */

export interface EncoderSettings {
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
}

export class ProgramEncoder {
  private encoder: VideoEncoder | null = null;
  private timer: number | null = null;
  private keyAt = 0;
  sentFrames = 0;
  sentBytes = 0;
  error = "";

  static supported(): boolean {
    return typeof VideoEncoder !== "undefined";
  }

  async start(canvas: HTMLCanvasElement, s: EncoderSettings): Promise<void> {
    if (!ProgramEncoder.supported())
      throw new Error("This window cannot encode video (WebCodecs is missing).");
    const level = s.height >= 1080 ? "640028" : "64001f";
    const config: VideoEncoderConfig = {
      codec: `avc1.${level}`,
      width: s.width,
      height: s.height,
      bitrate: s.bitrateKbps * 1000,
      framerate: s.fps,
      latencyMode: "realtime",
      hardwareAcceleration: "prefer-hardware",
      avc: { format: "annexb" },
      bitrateMode: "constant",
    };
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) throw new Error("This PC cannot hardware-encode H.264 at that size.");
    this.encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.sentFrames++;
        this.sentBytes += data.length;
        bridge.ps5OutVideo({ key: chunk.type === "key", ts: chunk.timestamp, data });
      },
      error: (e) => {
        this.error = e.message;
      },
    });
    this.encoder.configure(config);
    this.sentFrames = this.sentBytes = 0;
    this.error = "";
    const interval = 1000 / s.fps;
    const origin = performance.now();
    let next = origin;
    this.keyAt = 0;
    this.timer = window.setInterval(() => {
      const enc = this.encoder;
      if (!enc || enc.state !== "configured") return;
      const now = performance.now();
      if (now < next) return;
      next += interval;
      if (now - next > interval * 4) next = now + interval; // fell far behind: resync, do not burst
      if (enc.encodeQueueSize > 6) return; // encoder is behind: skip this frame
      const frame = new VideoFrame(canvas, { timestamp: Math.round((now - origin) * 1000) });
      const key = now - this.keyAt >= 2000 || this.keyAt === 0;
      if (key) this.keyAt = now;
      enc.encode(frame, { keyFrame: key });
      frame.close();
    }, 4);
  }

  /** Change the target bitrate while on air. Returns false when the encoder refused. */
  setBitrate(kbps: number, s: EncoderSettings): boolean {
    const enc = this.encoder;
    if (!enc || enc.state !== "configured") return false;
    try {
      enc.configure({
        codec: `avc1.${s.height >= 1080 ? "640028" : "64001f"}`,
        width: s.width,
        height: s.height,
        bitrate: kbps * 1000,
        framerate: s.fps,
        latencyMode: "realtime",
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "annexb" },
        bitrateMode: "constant",
      });
      this.keyAt = 0; // ask for a fresh keyframe so the new rate starts clean
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.encoder && this.encoder.state !== "closed") this.encoder.close();
    this.encoder = null;
  }
}

/* ------------------------------------------------------------------ controller from this PC */

const BUTTON_BITS: Array<[number, number]> = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [14, 4],
  [15, 5],
  [12, 6],
  [13, 7],
  [4, 8],
  [5, 9],
  [10, 10],
  [11, 11],
  [9, 12],
  [8, 13],
  [17, 14],
  [16, 15],
];

/** Polls a gamepad on this PC and returns its state; call from a timer. */
export function readPad(): { name: string; state: Ps5PadState } | null {
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad =>
    Boolean(p?.connected),
  );
  const pad = pads.find((p) => p.mapping === "standard") ?? pads[0];
  if (!pad) return null;
  let buttons = 0;
  for (const [index, bit] of BUTTON_BITS) if (pad.buttons[index]?.pressed) buttons |= 1 << bit;
  const axis = (i: number) => {
    const v = pad.axes[i] ?? 0;
    return Math.round((Math.abs(v) < 0.08 ? 0 : v) * 32767);
  };
  return {
    name: pad.id.replace(/\(.*\)/, "").trim(),
    state: {
      buttons,
      l2: Math.round((pad.buttons[6]?.value ?? 0) * 255),
      r2: Math.round((pad.buttons[7]?.value ?? 0) * 255),
      lx: axis(0),
      ly: axis(1),
      rx: axis(2),
      ry: axis(3),
    },
  };
}

/* ------------------------------------------------------------------ persistence */

const STORE_KEY = "pulsecast.studio.v1";

/** Everything that should come back the way you left it. */
export interface StudioPrefs {
  camId?: string;
  micId?: string;
  camOn?: boolean;
  camRes?: "720" | "1080";
  ps5Vol?: number;
  micVol?: number;
  monitor?: boolean;
  padOn?: boolean;
  preset?: string;
  picked?: Partial<Record<"twitch" | "facebook", boolean>>;
  adaptive?: boolean;
  uploadKbps?: number;
  chatChannel?: string;
}

export interface StudioSave {
  scenes: Scene[];
  activeId: string;
  prefs?: StudioPrefs;
}

/* songs live in IndexedDB: they are far bigger than localStorage allows */

function songDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("pulsecast-studio", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("songs");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

export async function putSong(id: string, blob: Blob): Promise<void> {
  const db = await songDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getSong(id: string): Promise<Blob | null> {
  const db = await songDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const req = db.transaction("songs").objectStore("songs").get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteSong(id: string): Promise<void> {
  const db = await songDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export function loadStudio(): StudioSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudioSave;
      if (parsed.scenes?.length) return parsed;
    }
  } catch {
    // fall through to defaults
  }
  const scenes = defaultScenes();
  return { scenes, activeId: scenes[0].id };
}

export function saveStudio(save: StudioSave): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(save));
  } catch {
    // storage full or blocked: the session still works
  }
}
