import { useCallback, useEffect, useRef, useState } from "react";
import type { Ps5Platform, Ps5Status, Ps5VideoPacket } from "../../shared/contracts";
import { getBridge } from "../bridge";

const bridge = getBridge();

interface Nal {
  type: number;
  start: number;
}

function scanNals(data: Uint8Array): Nal[] {
  const out: Nal[] = [];
  for (let i = 0; i + 3 < data.length; i++) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
      out.push({ type: data[i + 3] & 0x1f, start: i + 3 });
      i += 3;
    }
  }
  return out;
}

function codecFromSps(data: Uint8Array, nals: Nal[]): string | null {
  const sps = nals.find((n) => n.type === 7);
  if (!sps || sps.start + 3 >= data.length) return null;
  const hex = (b: number) => b.toString(16).padStart(2, "0");
  return `avc1.${hex(data[sps.start + 1])}${hex(data[sps.start + 2])}${hex(data[sps.start + 3])}`;
}

/** Decodes the PS5's own H.264 (as sent, no re-encode) onto a canvas with WebCodecs. */
function usePs5Preview(canvas: React.RefObject<HTMLCanvasElement | null>, enabled: boolean) {
  const [fps, setFps] = useState(0);
  const [error, setError] = useState("");
  const [frames, setFrames] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof VideoDecoder === "undefined") {
      setError("This window cannot decode video (WebCodecs is missing).");
      return;
    }
    let decoder: VideoDecoder | null = null;
    let codec = "";
    let needKey = true;
    let pending: Uint8Array | null = null;
    let count = 0;
    let windowStart = performance.now();
    let windowFrames = 0;

    const make = (nextCodec: string) => {
      decoder?.close();
      codec = nextCodec;
      decoder = new VideoDecoder({
        output: (frame) => {
          const el = canvas.current;
          if (el) {
            if (el.width !== frame.displayWidth) el.width = frame.displayWidth;
            if (el.height !== frame.displayHeight) el.height = frame.displayHeight;
            el.getContext("2d")?.drawImage(frame, 0, 0);
          }
          frame.close();
          count++;
          windowFrames++;
          const now = performance.now();
          if (now - windowStart >= 1000) {
            setFps(Math.round((windowFrames * 1000) / (now - windowStart)));
            setFrames(count);
            windowStart = now;
            windowFrames = 0;
          }
        },
        error: (e) => {
          setError(`Decoder stopped: ${e.message}`);
          needKey = true;
        },
      });
      decoder.configure({
        codec: nextCodec,
        optimizeForLatency: true,
        hardwareAcceleration: "prefer-hardware",
        // @ts-expect-error avc.format is part of WebCodecs but missing from some lib.dom versions
        avc: { format: "annexb" },
      });
      needKey = true;
    };

    const onPacket = (packet: Ps5VideoPacket) => {
      const nals = scanNals(packet.data);
      const hasSlice = nals.some((n) => n.type === 1 || n.type === 5);
      if (!hasSlice) {
        // parameter sets arrive as their own tiny sample: keep them and prefix the next frame
        pending = packet.data;
        const next = codecFromSps(packet.data, nals);
        if (next && next !== codec) make(next);
        return;
      }
      if (!decoder || decoder.state === "closed") return;
      let data = packet.data;
      if (pending) {
        const joined = new Uint8Array(pending.length + data.length);
        joined.set(pending, 0);
        joined.set(data, pending.length);
        data = joined;
        pending = null;
      }
      const isKey = packet.key || nals.some((n) => n.type === 5);
      if (needKey) {
        if (!isKey) return;
        needKey = false;
      }
      if (decoder.decodeQueueSize > 8 && !isKey) return; // fell behind: wait for a keyframe
      try {
        decoder.decode(
          new EncodedVideoChunk({ type: isKey ? "key" : "delta", timestamp: packet.ts, data }),
        );
      } catch (e) {
        needKey = true;
        setError(e instanceof Error ? e.message : "Decode failed.");
      }
    };

    const unsubscribe = bridge.subscribePs5Video(onPacket);
    return () => {
      unsubscribe();
      if (decoder && decoder.state !== "closed") decoder.close();
    };
  }, [canvas, enabled]);

  return { fps, frames, error };
}

const BUTTON_BITS: Array<[number, number]> = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3], // cross, moon, box, pyramid
  [14, 4],
  [15, 5],
  [12, 6],
  [13, 7], // d-pad left, right, up, down
  [4, 8],
  [5, 9],
  [10, 10],
  [11, 11], // L1 R1 L3 R3
  [9, 12],
  [8, 13],
  [17, 14],
  [16, 15], // options, share, touchpad, PS
];

/** Reads a gamepad on this PC (for example a DualSense over Bluetooth) and sends it to the PS5 session. */
function usePs5Pad(enabled: boolean) {
  const [padName, setPadName] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let last = "";
    let lastSent = 0;
    const dead = (v: number) => (Math.abs(v) < 0.08 ? 0 : v);
    const tick = () => {
      const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad =>
        Boolean(p?.connected),
      );
      const pad = pads.find((p) => p.mapping === "standard") ?? pads[0];
      setPadName((prev) => {
        const next = pad ? pad.id.replace(/\(.*\)/, "").trim() : "";
        return prev === next ? prev : next;
      });
      if (!pad) return;
      let buttons = 0;
      for (const [index, bit] of BUTTON_BITS) {
        if (pad.buttons[index]?.pressed) buttons |= 1 << bit;
      }
      const axis = (i: number) => Math.round(dead(pad.axes[i] ?? 0) * 32767);
      const state = {
        buttons,
        l2: Math.round((pad.buttons[6]?.value ?? 0) * 255),
        r2: Math.round((pad.buttons[7]?.value ?? 0) * 255),
        lx: axis(0),
        ly: axis(1),
        rx: axis(2),
        ry: axis(3),
      };
      const key = JSON.stringify(state);
      const now = performance.now();
      if (key !== last || now - lastSent > 250) {
        last = key;
        lastSent = now;
        bridge.ps5Input(state);
      }
    };
    const timer = window.setInterval(tick, 8);
    return () => {
      window.clearInterval(timer);
      bridge.ps5Input({ buttons: 0, l2: 0, r2: 0, lx: 0, ly: 0, rx: 0, ry: 0 });
    };
  }, [enabled]);
  return padName;
}

const PRESETS = [
  {
    id: "weak",
    label: "Weak internet",
    note: "720p · 30 fps · 2.5 Mbps",
    res: 720,
    fps: 30,
    kbps: 2500,
  },
  { id: "steady", label: "Steady", note: "720p · 30 fps · 4 Mbps", res: 720, fps: 30, kbps: 4000 },
  { id: "sharp", label: "Sharp", note: "1080p · 30 fps · 6 Mbps", res: 1080, fps: 30, kbps: 6000 },
] as const;

const PLATFORMS: Array<{ id: Ps5Platform; label: string }> = [
  { id: "twitch", label: "Twitch" },
  { id: "facebook", label: "Facebook" },
];

export function GoLiveView({ onBack }: { onBack(): void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Ps5Status | null>(null);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("steady");
  const [picked, setPicked] = useState<Record<Ps5Platform, boolean>>({
    twitch: true,
    facebook: true,
  });
  const [keyDraft, setKeyDraft] = useState<Record<Ps5Platform, string>>({
    twitch: "",
    facebook: "",
  });
  const [problem, setProblem] = useState("");

  useEffect(() => {
    void bridge.ps5Status().then(setStatus);
    return bridge.subscribePs5Status(setStatus);
  }, []);

  const [padOn, setPadOn] = useState(true);
  const padName = usePs5Pad(Boolean(status?.running) && padOn);
  const preview = usePs5Preview(canvas, Boolean(status?.running));
  const running = status?.running ?? false;
  const live = status?.live ?? false;
  const flowing = running && status?.proof === "real" && preview.frames > 0;

  const run = useCallback(async (job: () => Promise<Ps5Status>) => {
    setProblem("");
    try {
      setStatus(await job());
    } catch (error) {
      setProblem(
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
          : "That did not work.",
      );
    }
  }, []);

  const chosen = PRESETS.find((p) => p.id === preset) ?? PRESETS[1];
  const targets = PLATFORMS.filter(
    (p) => picked[p.id] && status?.destinations.find((d) => d.platform === p.id)?.keySet,
  );

  return (
    <main className="golive" data-testid="golive">
      <header className="golive__top">
        <button className="golive__back" type="button" onClick={onBack}>
          ← Launch
        </button>
        <span className="golive__tag">PS5 · NO CAPTURE CARD · NO RE-ENCODE</span>
        <span className={`golive__badge ${live ? "is-live" : running ? "is-on" : ""}`}>
          <i />
          {live ? "ON AIR" : running ? "PREVIEW" : "OFFLINE"}
        </span>
      </header>

      <section className="golive__stage">
        <div className={`monitor ${flowing ? "monitor--on" : ""}`}>
          <canvas
            ref={canvas}
            className="monitor__canvas"
            width={1280}
            height={720}
            data-testid="ps5-canvas"
          />
          {!flowing && (
            <div className="monitor__idle">
              <strong>{running ? "Waiting for the PS5…" : "PS5 screen"}</strong>
              <span>
                {running
                  ? "Connecting over Remote Play. This takes a few seconds."
                  : "Start the preview to see your game here."}
              </span>
            </div>
          )}
          <div className="monitor__hud">
            <span>{flowing ? `${status?.width}×${status?.height}` : "—"}</span>
            <span>{flowing ? `${preview.fps} fps shown` : ""}</span>
            <span className="monitor__proof">
              {status?.proof === "real" ? "REAL · PS5 H.264 as sent" : "UNAVAILABLE"}
            </span>
          </div>
        </div>

        <aside className="deck">
          <div className="deck__block">
            <span className="eyebrow">QUALITY</span>
            <div className="deck__presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${preset === p.id ? "chip--on" : ""}`}
                  disabled={running}
                  onClick={() => setPreset(p.id)}
                >
                  <strong>{p.label}</strong>
                  <small>{p.note}</small>
                </button>
              ))}
            </div>
            <small className="deck__hint">
              Pick below your upload speed. The PS5 encodes once at this rate and that exact video
              goes upstream.
            </small>
          </div>

          <div className="deck__block">
            <span className="eyebrow">CONTROLLER</span>
            <label className="dest__row">
              <input type="checkbox" checked={padOn} onChange={(e) => setPadOn(e.target.checked)} />
              <strong>Play from this PC</strong>
              <span className={`dest__state ${padOn && padName ? "dest__state--live" : ""}`}>
                {!padOn ? "off" : padName ? "connected" : "none found"}
              </span>
            </label>
            <small className="deck__hint">
              {padOn
                ? padName
                  ? `${padName}. Your presses go to the PS5 through this session. Keep this window focused. Turn the controller off on the PS5 side, or it will fight for the player slot.`
                  : "Pair a controller to this PC over Bluetooth, then press any button."
                : "Off: use the controller on the PS5. It may drop the session when it reconnects."}
            </small>
          </div>

          <div className="deck__block">
            <span className="eyebrow">DESTINATIONS</span>
            {PLATFORMS.map((p) => {
              const dest = status?.destinations.find((d) => d.platform === p.id);
              return (
                <div className="dest" key={p.id}>
                  <label className="dest__row">
                    <input
                      type="checkbox"
                      checked={picked[p.id]}
                      disabled={live}
                      onChange={(e) => setPicked({ ...picked, [p.id]: e.target.checked })}
                    />
                    <strong>{p.label}</strong>
                    <span className={`dest__state dest__state--${dest?.state ?? "idle"}`}>
                      {dest?.state === "live"
                        ? "live"
                        : dest?.state === "error"
                          ? "retrying"
                          : dest?.keySet
                            ? "key saved"
                            : "no key"}
                    </span>
                  </label>
                  <div className="dest__key">
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        dest?.keySet ? "Saved. Paste a new key to replace" : "Paste stream key"
                      }
                      value={keyDraft[p.id]}
                      disabled={live}
                      onChange={(e) => setKeyDraft({ ...keyDraft, [p.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={live || !keyDraft[p.id].trim()}
                      onClick={() => {
                        const value = keyDraft[p.id];
                        setKeyDraft({ ...keyDraft, [p.id]: "" });
                        void run(() => bridge.ps5SetKey(p.id, value));
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
            <small className="deck__hint">
              Keys are encrypted by Windows for your account and never shown again.
            </small>
          </div>

          <div className="deck__actions">
            {!running ? (
              <button
                type="button"
                className="button button--primary golive__cta"
                disabled={!status?.ready}
                onClick={() =>
                  void run(() =>
                    bridge.ps5Start({ res: chosen.res, fps: chosen.fps, bitrateKbps: chosen.kbps }),
                  )
                }
              >
                Start PS5 preview
              </button>
            ) : !live ? (
              <>
                <button
                  type="button"
                  className="button button--primary golive__cta"
                  disabled={!flowing || targets.length === 0}
                  onClick={() => void run(() => bridge.ps5GoLive(targets.map((t) => t.id)))}
                >
                  Go live{targets.length ? ` to ${targets.map((t) => t.label).join(" + ")}` : ""}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void run(() => bridge.ps5Stop())}
                >
                  Stop preview
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button button--danger golive__cta"
                onClick={() => void run(() => bridge.ps5EndLive())}
              >
                End stream
              </button>
            )}
            {running && !live && targets.length === 0 && (
              <small className="deck__hint">
                Save a stream key and tick a destination to enable Go live.
              </small>
            )}
          </div>

          <div className="deck__stats" aria-live="polite">
            <span>
              <small>Upstream</small>
              <strong>{live ? `${Math.round(status?.videoKbps ?? 0)} kbps` : "—"}</strong>
            </span>
            <span>
              <small>Dropped</small>
              <strong>{live ? `${status?.droppedKb ?? 0} KB` : "—"}</strong>
            </span>
            <span>
              <small>Frames shown</small>
              <strong>{preview.frames || "—"}</strong>
            </span>
          </div>
          {(problem || status?.lastError || preview.error || (status && !status.ready)) && (
            <p className="golive__problem" role="alert">
              {problem ||
                status?.lastError ||
                preview.error ||
                `Missing: ${status?.missing.join(", ")}`}
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
