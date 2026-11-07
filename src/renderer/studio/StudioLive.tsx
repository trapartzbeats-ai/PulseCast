import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ps5Platform, Ps5Status } from "../../shared/contracts";
import { getBridge } from "../bridge";
import {
  Compositor,
  Mixer,
  Ps5Feed,
  ProgramEncoder,
  defaultCameraLook,
  deleteSong,
  getSong,
  listDevices,
  loadStudio,
  makeLayer,
  putSong,
  readPad,
  saveStudio,
  uid,
  type CameraLook,
  type Layer,
  type LayerKind,
  type MediaChoice,
  type Scene,
  type StudioSave,
} from "./engine";

const bridge = getBridge();

const PRESETS = [
  { id: "weak", label: "Weak internet", note: "720p · 30 · 2.5 Mbps", w: 1280, h: 720, fps: 30, kbps: 2500 },
  { id: "steady", label: "Steady", note: "720p · 30 · 4 Mbps", w: 1280, h: 720, fps: 30, kbps: 4000 },
  { id: "sharp", label: "Sharp", note: "1080p · 30 · 6 Mbps", w: 1920, h: 1080, fps: 30, kbps: 6000 },
] as const;

const PLATFORMS: Array<{ id: Ps5Platform; label: string }> = [
  { id: "twitch", label: "Twitch" },
  { id: "facebook", label: "Facebook" },
];

const KIND_LABEL: Record<LayerKind, string> = {
  ps5: "PS5 game",
  camera: "Camera",
  text: "Text",
  image: "Image",
};

function dbToPercent(db: number): number {
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export function StudioLive({ onBack }: { onBack(): void }) {
  /* ---- engines (created once) ---- */
  const engines = useRef<{ feed: Ps5Feed; comp: Compositor; mixer: Mixer; enc: ProgramEncoder } | null>(null);
  if (!engines.current) {
    const feed = new Ps5Feed();
    engines.current = { feed, comp: new Compositor(feed), mixer: new Mixer(feed), enc: new ProgramEncoder() };
  }
  const { feed, comp, mixer, enc } = engines.current;

  /* ---- state ---- */
  const [save, setSave] = useState<StudioSave>(() => loadStudio());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Ps5Status | null>(null);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>(
    PRESETS.find((p) => p.id === save.prefs?.preset)?.id ?? "steady",
  );
  const [picked, setPicked] = useState<Record<Ps5Platform, boolean>>({
    twitch: save.prefs?.picked?.twitch ?? true,
    facebook: save.prefs?.picked?.facebook ?? true,
  });
  const [keyDraft, setKeyDraft] = useState<Record<Ps5Platform, string>>({ twitch: "", facebook: "" });
  const [problem, setProblem] = useState("");
  const [devices, setDevices] = useState<{ cameras: MediaChoice[]; mics: MediaChoice[] }>({ cameras: [], mics: [] });
  const [camId, setCamId] = useState(save.prefs?.camId ?? "");
  const [micId, setMicId] = useState(save.prefs?.micId ?? "");
  const [camOn, setCamOn] = useState(save.prefs?.camOn ?? false);
  const [camRes, setCamRes] = useState<"720" | "1080">(save.prefs?.camRes ?? "720");
  const [ps5Vol, setPs5Vol] = useState(save.prefs?.ps5Vol ?? 1);
  const [micVol, setMicVol] = useState(save.prefs?.micVol ?? 1);
  const [monitor, setMonitor] = useState(save.prefs?.monitor ?? false);
  const [padOn, setPadOn] = useState(save.prefs?.padOn ?? true);
  const [adaptive, setAdaptive] = useState(save.prefs?.adaptive ?? true);
  const [uploadKbps, setUploadKbps] = useState(save.prefs?.uploadKbps ?? 0);
  const [testing, setTesting] = useState(false);
  const [netNote, setNetNote] = useState("");
  const [liveRate, setLiveRate] = useState(0);
  const [padName, setPadName] = useState("");
  const [autoRe, setAutoRe] = useState(() => {
    try {
      return localStorage.getItem("pulsecast.autoReconnect") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    bridge.ps5SetAutoReconnect(autoRe);
    try {
      localStorage.setItem("pulsecast.autoReconnect", autoRe ? "1" : "0");
    } catch {
      /* per-viewer convenience only */
    }
  }, [autoRe, bridge]);
  const [meters, setMeters] = useState({ ps5: -90, mic: -90, song: -90, fps: 0, ps5Live: false, kbps: 0 });
  const [busy, setBusy] = useState(false);

  const mounted = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const live = status?.live ?? false;
  const ps5Running = status?.running ?? false;
  const preview = PRESETS.find((p) => p.id === preset) ?? PRESETS[1];

  const scene = save.scenes.find((s) => s.id === save.activeId) ?? save.scenes[0];
  const selected = scene.layers.find((l) => l.id === selectedId) ?? null;

  /* ---- scene editing ---- */
  const updateScene = useCallback(
    (fn: (s: Scene) => Scene) =>
      setSave((prev) => ({ ...prev, scenes: prev.scenes.map((s) => (s.id === prev.activeId ? fn(s) : s)) })),
    [],
  );
  const updateLayer = useCallback(
    (id: string, patch: Partial<Layer>) =>
      updateScene((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
    [updateScene],
  );
  const addLayer = (kind: LayerKind, extra: Partial<Layer> = {}) => {
    const layer = makeLayer(kind, extra);
    updateScene((s) => ({ ...s, layers: [...s.layers, layer] }));
    setSelectedId(layer.id);
  };
  const moveLayer = (id: string, dir: 1 | -1) =>
    updateScene((s) => {
      const i = s.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.layers.length) return s;
      const layers = [...s.layers];
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...s, layers };
    });
  const removeLayer = (id: string) => {
    updateScene((s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
  };
  const addScene = () => {
    const next: Scene = { id: uid(), name: `Scene ${save.scenes.length + 1}`, layers: [] };
    setSave((prev) => ({ scenes: [...prev.scenes, next], activeId: next.id }));
    setSelectedId(null);
  };
  const duplicateScene = () => {
    const copy: Scene = {
      id: uid(),
      name: `${scene.name} copy`,
      layers: scene.layers.map((l) => ({ ...l, id: uid() })),
    };
    setSave((prev) => ({ scenes: [...prev.scenes, copy], activeId: copy.id }));
    setSelectedId(null);
  };
  const deleteScene = () => {
    if (save.scenes.length <= 1) return;
    setSave((prev) => {
      const scenes = prev.scenes.filter((s) => s.id !== prev.activeId);
      return { scenes, activeId: scenes[0].id };
    });
    setSelectedId(null);
  };
  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setProblem("That image is over 4 MB. Use a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => addLayer("image", { name: file.name.replace(/\.[^.]+$/, ""), image: String(reader.result) });
    reader.readAsDataURL(file);
  };

  /* ---- persistence ---- */
  useEffect(
    () =>
      saveStudio({
        ...save,
        prefs: { camId, micId, camOn, camRes, ps5Vol, micVol, monitor, padOn, preset, picked, adaptive, uploadKbps },
      }),
    [save, camId, micId, camOn, camRes, ps5Vol, micVol, monitor, padOn, preset, picked, adaptive, uploadKbps],
  );

  /* ---- mount: engines, status, devices ---- */
  useEffect(() => {
    mounted.current = true;
    comp.canvas.className = "sx-canvas";
    stageRef.current?.prepend(comp.canvas);
    feed.start();
    void mixer.resume();
    void bridge.ps5Status().then(setStatus);
    const off = bridge.subscribePs5Status(setStatus);
    const refreshDevices = () => void listDevices().then(setDevices).catch(() => undefined);
    refreshDevices();
    // device names stay blank until the app has been allowed to open a microphone once
    void navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        s.getTracks().forEach((t) => t.stop());
        refreshDevices();
      })
      .catch((e) => setProblem(`Microphone: ${e instanceof Error ? `${e.name} - ${e.message}` : "could not open"}. Check Windows Settings > Privacy > Microphone > "Let desktop apps access your microphone".`));
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      off();
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      enc.stop();
      mixer.onPcm = null;
      feed.stop();
      camStream.current?.getTracks().forEach((t) => t.stop());
      comp.canvas.remove();
      mounted.current = false;
      // React StrictMode re-runs effects in dev: only really close the audio engine if we stay unmounted
      window.setTimeout(() => {
        if (!mounted.current) mixer.dispose();
      }, 400);
      bridge.ps5Input({ buttons: 0, l2: 0, r2: 0, lx: 0, ly: 0, rx: 0, ry: 0 });
    };
  }, [comp, enc, feed, mixer]);

  /* ---- draw loop and meters ---- */
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => {
    const draw = window.setInterval(() => {
      comp.scene = sceneRef.current;
      comp.draw();
    }, 1000 / 30);
    let lastFrames = feed.frames;
    let lastBytes = enc.sentBytes;
    const stats = window.setInterval(() => {
      const fps = feed.frames - lastFrames;
      lastFrames = feed.frames;
      const kbps = Math.round(((enc.sentBytes - lastBytes) * 8) / 1000);
      lastBytes = enc.sentBytes;
      setMeters({ ps5: mixer.ps5Db(), mic: mixer.micDb(), song: mixer.songDb(), fps, ps5Live: feed.live, kbps });
    }, 1000);
    const fast = window.setInterval(
      () => setMeters((m) => ({ ...m, ps5: mixer.ps5Db(), mic: mixer.micDb(), song: mixer.songDb() })),
      120,
    );
    return () => {
      window.clearInterval(draw);
      window.clearInterval(stats);
      window.clearInterval(fast);
    };
  }, [comp, enc, feed, mixer]);

  /* ---- output size follows the quality preset (locked while live) ---- */
  useEffect(() => {
    if (!live) comp.resize(preview.w, preview.h);
  }, [comp, live, preview.h, preview.w]);

  /* ---- audio levels and devices ---- */
  useEffect(() => mixer.setPs5Volume(ps5Vol), [mixer, ps5Vol]);
  useEffect(() => mixer.setMicVolume(micVol), [mixer, micVol]);
  useEffect(() => mixer.setMonitor(monitor), [mixer, monitor]);
  useEffect(() => {
    void mixer.setMic(micId || null).catch((e) => setProblem(`Microphone: ${e instanceof Error ? e.message : "could not open"}`));
  }, [micId, mixer]);
  useEffect(() => {
    let cancelled = false;
    const stop = () => {
      camStream.current?.getTracks().forEach((t) => t.stop());
      camStream.current = null;
      comp.camera = null;
    };
    if (!camOn) {
      stop();
      return;
    }
    void navigator.mediaDevices
      .getUserMedia({
        video: {
          deviceId: camId ? { exact: camId } : undefined,
          width: { ideal: camRes === "1080" ? 1920 : 1280 },
          height: { ideal: camRes === "1080" ? 1080 : 720 },
          frameRate: { ideal: 30 },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stop();
        camStream.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().catch(() => undefined);
          comp.camera = v;
        }
        void listDevices().then(setDevices);
      })
      .catch((e) => {
        setCamOn(false);
        setProblem(`Camera: ${e instanceof Error ? e.message : "could not open"}`);
      });
    return () => {
      cancelled = true;
    };
  }, [camOn, camId, camRes, comp]);

  /* ---- controller from this PC ---- */
  useEffect(() => {
    if (!ps5Running || !padOn) {
      setPadName("");
      return;
    }
    let last = "";
    let lastSent = 0;
    const timer = window.setInterval(() => {
      const pad = readPad();
      setPadName((prev) => (prev === (pad?.name ?? "") ? prev : (pad?.name ?? "")));
      if (!pad) return;
      const key = JSON.stringify(pad.state);
      const now = performance.now();
      if (key !== last || now - lastSent > 250) {
        last = key;
        lastSent = now;
        bridge.ps5Input(pad.state);
      }
    }, 8);
    return () => {
      window.clearInterval(timer);
      bridge.ps5Input({ buttons: 0, l2: 0, r2: 0, lx: 0, ly: 0, rx: 0, ry: 0 });
    };
  }, [ps5Running, padOn]);

  /* ---- per-scene audio: mutes and a song that plays while the scene is on ---- */
  const sceneAudio = scene.audio;
  const songMeta = sceneAudio?.song ?? null;
  useEffect(() => {
    mixer.setMutes(Boolean(sceneAudio?.ps5Muted), Boolean(sceneAudio?.micMuted));
  }, [mixer, sceneAudio?.ps5Muted, sceneAudio?.micMuted]);
  useEffect(() => {
    let cancelled = false;
    if (!songMeta) {
      mixer.stopSong();
      return;
    }
    void (async () => {
      try {
        const blob = await getSong(songMeta.id);
        if (cancelled) return;
        if (!blob) {
          setProblem(`The song for "${scene.name}" is missing from this PC's storage. Choose it again.`);
          return;
        }
        await mixer.resume();
        await mixer.playSong(songMeta.id, blob, songMeta.volume, songMeta.loop);
      } catch (error) {
        setProblem(`Song: ${error instanceof Error ? error.message : "could not play"}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // only the song identity, loop and scene decide a restart; volume is applied live below
  }, [mixer, scene.id, songMeta?.id, songMeta?.loop]);
  useEffect(() => {
    if (songMeta) mixer.setSongVolume(songMeta.volume);
  }, [mixer, songMeta, songMeta?.volume]);

  const updateAudio = (patch: Partial<NonNullable<Scene["audio"]>>) =>
    updateScene((sc) => ({ ...sc, audio: { ...sc.audio, ...patch } }));
  const pickSong = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      setProblem("That song is over 60 MB. Use a smaller file.");
      return;
    }
    try {
      const id = uid();
      await putSong(id, file);
      const old = sceneAudio?.song;
      updateAudio({ song: { id, name: file.name.replace(/\.[^.]+$/, ""), volume: old?.volume ?? 0.6, loop: true } });
      if (old) void deleteSong(old.id);
    } catch {
      setProblem("Could not keep that song on this PC (browser storage refused it).");
    }
  };
  const removeSong = () => {
    const old = sceneAudio?.song;
    updateAudio({ song: null });
    if (old) void deleteSong(old.id);
  };

  /* ---- upload speed test, and a live bitrate guard ---- */
  const recommended = uploadKbps
    ? [...PRESETS].reverse().find((p) => p.kbps <= uploadKbps * 0.7) ?? PRESETS[0]
    : null;
  const rateCap = uploadKbps ? Math.max(1200, Math.min(preview.kbps, Math.floor(uploadKbps * 0.7))) : preview.kbps;
  const statusRef = useRef(status);
  statusRef.current = status;
  const testUpload = async () => {
    setTesting(true);
    setNetNote("");
    try {
      const r = await bridge.netUploadTest();
      setUploadKbps(r.kbps);
      setNetNote(`Measured ${(r.kbps / 1000).toFixed(1)} Mbps up in ${r.seconds}s.`);
    } catch (error) {
      setNetNote(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Test failed.");
    } finally {
      setTesting(false);
    }
  };
  useEffect(() => {
    if (!live) {
      setLiveRate(0);
      return;
    }
    let rate = rateCap;
    let lastDropped = statusRef.current?.droppedKb ?? 0;
    let calm = 0;
    setLiveRate(rate);
    if (!adaptive) return;
    const timer = window.setInterval(() => {
      const dropped = statusRef.current?.droppedKb ?? 0;
      if (dropped > lastDropped) {
        // the connection could not carry the stream: step down and ask for a fresh keyframe
        rate = Math.max(1200, Math.round(rate * 0.8));
        calm = 0;
        if (enc.setBitrate(rate, { width: preview.w, height: preview.h, fps: preview.fps, bitrateKbps: rate })) setLiveRate(rate);
      } else if (++calm >= 6 && rate < rateCap) {
        rate = Math.min(rateCap, Math.round(rate * 1.1));
        calm = 0;
        if (enc.setBitrate(rate, { width: preview.w, height: preview.h, fps: preview.fps, bitrateKbps: rate })) setLiveRate(rate);
      }
      lastDropped = dropped;
    }, 5000);
    return () => window.clearInterval(timer);
  }, [live, adaptive, rateCap, enc, preview.w, preview.h, preview.fps]);

  /* ---- hotkeys: 1-9 switch scene ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && save.scenes[n - 1]) {
        setSave((prev) => ({ ...prev, activeId: prev.scenes[n - 1].id }));
        setSelectedId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) removeLayer(selectedId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save.scenes, selectedId]);

  /* ---- PS5 + stream actions ---- */
  const run = useCallback(async (job: () => Promise<Ps5Status | void>) => {
    setProblem("");
    setBusy(true);
    try {
      const result = await job();
      if (result) setStatus(result);
    } catch (error) {
      setProblem(
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
          : "That did not work.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const startPs5 = () =>
    run(() =>
      bridge.ps5Start({
        res: preview.h >= 1080 ? 1080 : 720,
        fps: 30,
        // we re-encode in this mode, so feed the encoder a clean, high-rate source
        bitrateKbps: preview.h >= 1080 ? 10000 : 7000,
      }),
    );

  const targets = PLATFORMS.filter(
    (p) => picked[p.id] && status?.destinations.find((d) => d.platform === p.id)?.keySet,
  );

  const goLive = () =>
    run(async () => {
      await mixer.resume();
      comp.resize(preview.w, preview.h);
      const result = await bridge.ps5GoLive(
        targets.map((t) => t.id),
        { mode: "composited", width: preview.w, height: preview.h, fps: preview.fps },
      );
      // send the mix as 10 ms packets, which is what the sender expects
      let carry = new Int16Array(0);
      mixer.onPcm = (pcm) => {
        // hold audio until the encoder has produced video, so both start together
        if (enc.sentFrames === 0) return;
        const joined = new Int16Array(carry.length + pcm.length);
        joined.set(carry, 0);
        joined.set(pcm, carry.length);
        let offset = 0;
        const step = 480 * 2;
        while (joined.length - offset >= step) {
          const chunk = joined.slice(offset, offset + step);
          bridge.ps5OutAudio(new Uint8Array(chunk.buffer));
          offset += step;
        }
        carry = joined.slice(offset);
      };
      try {
        await enc.start(comp.canvas, { width: preview.w, height: preview.h, fps: preview.fps, bitrateKbps: rateCap });
      } catch (error) {
        mixer.onPcm = null;
        await bridge.ps5EndLive();
        throw error;
      }
      return result;
    });

  const endLive = () =>
    run(async () => {
      enc.stop();
      mixer.onPcm = null;
      return bridge.ps5EndLive();
    });

  /* ---- drag / resize layers on the canvas ---- */
  const drag = useRef<{ id: string; mode: "move" | "size"; sx: number; sy: number; layer: Layer } | null>(null);
  const toFraction = (clientX: number, clientY: number) => {
    const r = comp.canvas.getBoundingClientRect();
    return { fx: (clientX - r.left) / r.width, fy: (clientY - r.top) / r.height };
  };
  const onStageDown = (e: React.PointerEvent) => {
    const { fx, fy } = toFraction(e.clientX, e.clientY);
    const hit = [...scene.layers].reverse().find((l) => l.visible && fx >= l.x && fx <= l.x + l.w && fy >= l.y && fy <= l.y + l.h);
    setSelectedId(hit?.id ?? null);
    if (hit) {
      drag.current = { id: hit.id, mode: "move", sx: fx, sy: fy, layer: hit };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const onSizeDown = (e: React.PointerEvent, layer: Layer) => {
    e.stopPropagation();
    const { fx, fy } = toFraction(e.clientX, e.clientY);
    drag.current = { id: layer.id, mode: "size", sx: fx, sy: fy, layer };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onStageMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { fx, fy } = toFraction(e.clientX, e.clientY);
    const dx = fx - d.sx;
    const dy = fy - d.sy;
    if (d.mode === "move") {
      updateLayer(d.id, { x: Math.round((d.layer.x + dx) * 1000) / 1000, y: Math.round((d.layer.y + dy) * 1000) / 1000 });
    } else {
      updateLayer(d.id, {
        w: Math.max(0.02, Math.round((d.layer.w + dx) * 1000) / 1000),
        h: Math.max(0.02, Math.round((d.layer.h + dy) * 1000) / 1000),
      });
    }
  };
  const onStageUp = () => {
    drag.current = null;
  };

  const ordered = useMemo(() => [...scene.layers].reverse(), [scene.layers]);
  const ps5Flowing = meters.ps5Live;

  return (
    <main className="sx" data-testid="studio-live">
      <video ref={videoRef} className="sx-hidden-video" muted playsInline />
      <header className="sx-top">
        <button className="golive__back" type="button" onClick={onBack}>
          ← Launch
        </button>
        <span className="golive__tag">STUDIO · PS5 + CAMERA + OVERLAYS</span>
        <span className="sx-output-note">
          {live ? "Encoding this scene once on this PC" : "Output: 1 encode on this PC when live"}
        </span>
        <span className={`golive__badge ${live ? "is-live" : ps5Flowing ? "is-on" : ""}`}>
          <i />
          {live ? "ON AIR" : ps5Flowing ? "PS5 LIVE" : "OFFLINE"}
        </span>
      </header>

      <div className="sx-grid">
        {/* ---------------- left: scenes + layers ---------------- */}
        <aside className="sx-col">
          <section className="sx-panel">
            <header>
              <span className="eyebrow">SCENES</span>
              <span className="sx-hint">keys 1–9</span>
            </header>
            <ul className="sx-scenes">
              {save.scenes.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === save.activeId ? "is-active" : ""}
                    onClick={() => {
                      setSave((prev) => ({ ...prev, activeId: s.id }));
                      setSelectedId(null);
                    }}
                  >
                    <kbd>{i + 1 <= 9 ? i + 1 : ""}</kbd>
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="sx-row">
              <button type="button" className="button button--ghost" onClick={addScene}>
                + Scene
              </button>
              <button type="button" className="button button--ghost" onClick={duplicateScene}>
                Duplicate
              </button>
              <button type="button" className="button button--ghost" onClick={deleteScene} disabled={save.scenes.length <= 1}>
                Delete
              </button>
            </div>
            <input
              className="sx-input"
              value={scene.name}
              aria-label="Scene name"
              onChange={(e) => updateScene((s) => ({ ...s, name: e.target.value }))}
            />
          </section>

          <section className="sx-panel">
            <header>
              <span className="eyebrow">SOUND IN “{scene.name.toUpperCase()}”</span>
              <span className="sx-hint">saved with the scene</span>
            </header>
            <label className="sx-toggle">
              <input type="checkbox" checked={Boolean(sceneAudio?.micMuted)} onChange={(e) => updateAudio({ micMuted: e.target.checked })} /> Mute my microphone
            </label>
            <label className="sx-toggle">
              <input type="checkbox" checked={Boolean(sceneAudio?.ps5Muted)} onChange={(e) => updateAudio({ ps5Muted: e.target.checked })} /> Mute the PS5 game sound
            </label>
            <div className="sx-song">
              {songMeta ? (
                <>
                  <div className="sx-row">
                    <strong className="sx-song__name">♪ {songMeta.name}</strong>
                    <button type="button" className="button button--ghost" onClick={removeSong}>
                      Remove
                    </button>
                  </div>
                  <div className="sx-meter">
                    <i style={{ width: `${dbToPercent(meters.song)}%` }} />
                  </div>
                  <label>
                    Song volume
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={songMeta.volume}
                      onChange={(e) => updateAudio({ song: { ...songMeta, volume: Number(e.target.value) } })}
                    />
                  </label>
                  <label className="sx-toggle">
                    <input type="checkbox" checked={songMeta.loop} onChange={(e) => updateAudio({ song: { ...songMeta, loop: e.target.checked } })} /> Repeat
                  </label>
                  <small className="deck__hint">Plays when this scene is on air and fades out when you leave it. Tick “hear on this PC” to listen.</small>
                </>
              ) : (
                <label className="button button--ghost sx-file">
                  + Song for this scene
                  <input type="file" accept="audio/*" onChange={(e) => void pickSong(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </section>

          <section className="sx-panel">
            <header>
              <span className="eyebrow">SOURCES IN “{scene.name.toUpperCase()}”</span>
            </header>
            <ul className="sx-layers">
              {ordered.map((l) => (
                <li key={l.id} className={l.id === selectedId ? "is-selected" : ""}>
                  <button type="button" className="sx-eye" aria-label={l.visible ? "Hide" : "Show"} onClick={() => updateLayer(l.id, { visible: !l.visible })}>
                    {l.visible ? "●" : "○"}
                  </button>
                  <button type="button" className="sx-name" onClick={() => setSelectedId(l.id)}>
                    <strong>{l.name}</strong>
                    <small>{KIND_LABEL[l.kind]}</small>
                  </button>
                  <button type="button" className="sx-mini" aria-label="Bring forward" onClick={() => moveLayer(l.id, 1)}>
                    ↑
                  </button>
                  <button type="button" className="sx-mini" aria-label="Send back" onClick={() => moveLayer(l.id, -1)}>
                    ↓
                  </button>
                </li>
              ))}
              {ordered.length === 0 && <li className="sx-empty">Nothing here yet. Add a source below.</li>}
            </ul>
            <div className="sx-adds">
              <button type="button" className="button button--ghost" onClick={() => addLayer("ps5")}>
                + PS5
              </button>
              <button type="button" className="button button--ghost" onClick={() => addLayer("camera")}>
                + Camera
              </button>
              <button type="button" className="button button--ghost" onClick={() => addLayer("text")}>
                + Text
              </button>
              <label className="button button--ghost sx-file">
                + Image
                <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
              </label>
            </div>
          </section>
        </aside>

        {/* ---------------- center: program canvas ---------------- */}
        <section className="sx-center">
          <div className="sx-stage" ref={stageRef} onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp}>
            {selected && selected.visible && (
              <div
                className="sx-box"
                style={{ left: `${selected.x * 100}%`, top: `${selected.y * 100}%`, width: `${selected.w * 100}%`, height: `${selected.h * 100}%` }}
              >
                <span className="sx-box__label">{selected.name}</span>
                <span className="sx-box__handle" onPointerDown={(e) => onSizeDown(e, selected)} />
              </div>
            )}
            {!ps5Flowing && scene.layers.some((l) => l.kind === "ps5" && l.visible) && (
              <div className="sx-note">PS5 not connected. Press “Start PS5” on the right.</div>
            )}
          </div>
          <div className="sx-statusline">
            <span>
              {comp.canvas.width}×{comp.canvas.height} · {preview.fps} fps
            </span>
            <span>{ps5Flowing ? `PS5 ${meters.fps} fps in · REAL` : "PS5 off"}</span>
            <span>{live ? `${meters.kbps} kbps out` : "not streaming"}</span>
          </div>

          <section className="sx-mixer">
            <div className="sx-strip">
              <header>
                <strong>PS5 game</strong>
                <label>
                  <input type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} /> hear on this PC
                </label>
              </header>
              <div className="sx-meter">
                <i style={{ width: `${dbToPercent(meters.ps5)}%` }} />
              </div>
              <input type="range" min={0} max={1.5} step={0.01} value={ps5Vol} onChange={(e) => setPs5Vol(Number(e.target.value))} aria-label="PS5 volume" />
            </div>
            <div className="sx-strip">
              <header>
                <strong>Microphone</strong>
                <select value={micId} onChange={(e) => setMicId(e.target.value)} aria-label="Microphone">
                  <option value="">Off</option>
                  {devices.mics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </header>
              <div className="sx-meter">
                <i style={{ width: `${dbToPercent(meters.mic)}%` }} />
              </div>
              <input type="range" min={0} max={2} step={0.01} value={micVol} onChange={(e) => setMicVol(Number(e.target.value))} aria-label="Microphone volume" />
            </div>
            <div className="sx-strip">
              <header>
                <strong>Camera</strong>
                <select value={camId} onChange={(e) => setCamId(e.target.value)} aria-label="Camera">
                  <option value="">Default</option>
                  {devices.cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </header>
              <div className="sx-row">
                <label className="sx-toggle">
                  <input type="checkbox" checked={camOn} onChange={(e) => setCamOn(e.target.checked)} /> Camera on
                </label>
                <select value={camRes} aria-label="Camera resolution" onChange={(e) => setCamRes(e.target.value as "720" | "1080")}>
                  <option value="720">720p</option>
                  <option value="1080">1080p</option>
                </select>
              </div>
              <small className="deck__hint">Add a Camera source to a scene to show it.</small>
            </div>
          </section>
        </section>

        {/* ---------------- right: inspector + go live ---------------- */}
        <aside className="sx-col">
          <section className="sx-panel">
            <header>
              <span className="eyebrow">{selected ? `${selected.name.toUpperCase()} · ${KIND_LABEL[selected.kind].toUpperCase()}` : "PROPERTIES"}</span>
            </header>
            {!selected && <p className="sx-empty">Click a source on the canvas or in the list.</p>}
            {selected && (
              <div className="sx-props">
                <label>
                  Name
                  <input className="sx-input" value={selected.name} onChange={(e) => updateLayer(selected.id, { name: e.target.value })} />
                </label>
                {selected.kind === "text" && selected.text && (
                  <>
                    <label>
                      Text
                      <textarea
                        className="sx-input"
                        rows={2}
                        value={selected.text.value}
                        onChange={(e) => updateLayer(selected.id, { text: { ...selected.text!, value: e.target.value } })}
                      />
                    </label>
                    <div className="sx-row">
                      <label>
                        Size
                        <input
                          className="sx-input"
                          type="number"
                          min={10}
                          max={400}
                          value={selected.text.size}
                          onChange={(e) => updateLayer(selected.id, { text: { ...selected.text!, size: Number(e.target.value) || 10 } })}
                        />
                      </label>
                      <label>
                        Colour
                        <input type="color" value={selected.text.color} onChange={(e) => updateLayer(selected.id, { text: { ...selected.text!, color: e.target.value } })} />
                      </label>
                    </div>
                    <div className="sx-row">
                      <label className="sx-toggle">
                        <input type="checkbox" checked={selected.text.bold} onChange={(e) => updateLayer(selected.id, { text: { ...selected.text!, bold: e.target.checked } })} /> Bold
                      </label>
                      <label className="sx-toggle">
                        <input type="checkbox" checked={selected.text.outline} onChange={(e) => updateLayer(selected.id, { text: { ...selected.text!, outline: e.target.checked } })} /> Outline
                      </label>
                      <select
                        value={selected.text.align}
                        aria-label="Alignment"
                        onChange={(e) => updateLayer(selected.id, { text: { ...selected.text!, align: e.target.value as "left" | "center" | "right" } })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Centre</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </>
                )}
                {selected.kind !== "text" && (
                  <label>
                    Fit
                    <select value={selected.fit} onChange={(e) => updateLayer(selected.id, { fit: e.target.value as Layer["fit"] })}>
                      <option value="contain">Fit inside</option>
                      <option value="cover">Fill (crop)</option>
                      <option value="stretch">Stretch</option>
                    </select>
                  </label>
                )}
                {selected.kind === "camera" && (() => {
                  const look: CameraLook = { ...defaultCameraLook(), ...selected.cam };
                  const setLook = (patch: Partial<CameraLook>) => updateLayer(selected.id, { cam: { ...look, ...patch } });
                  const range = (label: string, key: "zoom" | "shiftX" | "shiftY" | "brightness" | "contrast" | "saturation", min: number, max: number, step: number) => (
                    <label>
                      {label}
                      <input type="range" min={min} max={max} step={step} value={look[key]} onChange={(e) => setLook({ [key]: Number(e.target.value) })} />
                    </label>
                  );
                  return (
                    <>
                      <div className="sx-row">
                        <label className="sx-toggle">
                          <input type="checkbox" checked={Boolean(selected.mirror)} onChange={(e) => updateLayer(selected.id, { mirror: e.target.checked })} /> Mirror
                        </label>
                        <select value={look.shape} aria-label="Camera shape" onChange={(e) => setLook({ shape: e.target.value as CameraLook["shape"] })}>
                          <option value="rect">Rectangle</option>
                          <option value="rounded">Rounded</option>
                          <option value="circle">Circle</option>
                        </select>
                      </div>
                      {range("Zoom in", "zoom", 1, 3, 0.01)}
                      {look.zoom > 1 && range("Move left / right", "shiftX", -1, 1, 0.01)}
                      {look.zoom > 1 && range("Move up / down", "shiftY", -1, 1, 0.01)}
                      {range("Brightness", "brightness", 0.5, 1.5, 0.01)}
                      {range("Contrast", "contrast", 0.5, 1.5, 0.01)}
                      {range("Colour", "saturation", 0, 2, 0.01)}
                      <div className="sx-row">
                        <label>
                          Outline
                          <input type="range" min={0} max={16} step={1} value={look.borderWidth} onChange={(e) => setLook({ borderWidth: Number(e.target.value) })} />
                        </label>
                        <label>
                          Outline colour
                          <input type="color" value={look.borderColor} onChange={(e) => setLook({ borderColor: e.target.value })} />
                        </label>
                      </div>
                      <button type="button" className="button button--ghost" onClick={() => updateLayer(selected.id, { cam: defaultCameraLook() })}>
                        Reset camera look
                      </button>
                    </>
                  );
                })()}
                <label>
                  Opacity
                  <input type="range" min={0} max={1} step={0.01} value={selected.opacity} onChange={(e) => updateLayer(selected.id, { opacity: Number(e.target.value) })} />
                </label>
                <button type="button" className="button button--ghost" onClick={() => removeLayer(selected.id)}>
                  Remove source
                </button>
              </div>
            )}
          </section>

          <section className="sx-panel sx-live">
            <header>
              <span className="eyebrow">PS5</span>
              <span className={`dest__state ${ps5Flowing ? "dest__state--live" : ""}`}>{ps5Flowing ? "connected · real" : ps5Running ? "connecting…" : "off"}</span>
            </header>
            <div className="sx-row">
              {!ps5Running ? (
                <button type="button" className="button button--primary" disabled={!status?.ready || busy} onClick={() => void startPs5()}>
                  Start PS5
                </button>
              ) : (
                <button type="button" className="button button--ghost" disabled={live} onClick={() => void run(() => bridge.ps5Stop())}>
                  Stop PS5
                </button>
              )}
            </div>
            <label className="dest__row">
              <input type="checkbox" checked={padOn} onChange={(e) => setPadOn(e.target.checked)} />
              <strong>Play from this PC</strong>
              <span className={`dest__state ${padOn && padName ? "dest__state--live" : ""}`}>{!padOn ? "off" : padName ? "controller found" : "none found"}</span>
            </label>
            <label className="dest__row">
              <input type="checkbox" checked={autoRe} onChange={(e) => setAutoRe(e.target.checked)} />
              <strong>Auto-reconnect</strong>
              <span className="dest__state">{autoRe ? "on" : "off"}</span>
            </label>

            <span className="eyebrow">QUALITY</span>
            <div className="deck__presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className={`chip ${preset === p.id ? "chip--on" : ""}`} disabled={live || ps5Running} onClick={() => setPreset(p.id)}>
                  <strong>{p.label}</strong>
                  <small>{p.note}</small>
                </button>
              ))}
            </div>

            <span className="eyebrow">CONNECTION</span>
            <div className="sx-net">
              <div className="sx-row">
                <button type="button" className="button button--ghost" disabled={testing || live} onClick={() => void testUpload()}>
                  {testing ? "Testing…" : "Test my upload"}
                </button>
                <span className="dest__state">{uploadKbps ? `${(uploadKbps / 1000).toFixed(1)} Mbps up` : "not tested"}</span>
              </div>
              {netNote && <small className="deck__hint">{netNote}</small>}
              {recommended && (
                <small className="deck__hint">
                  Safe stream rate: {(Math.max(1200, Math.floor(uploadKbps * 0.7)) / 1000).toFixed(1)} Mbps (70% of your upload, so the rest is left for everything else).
                  {recommended.id !== preset && !live && !ps5Running && (
                    <>
                      {" "}
                      <button type="button" className="sx-link" onClick={() => setPreset(recommended.id)}>
                        Use “{recommended.label}”
                      </button>
                    </>
                  )}
                </small>
              )}
              <label className="dest__row">
                <input type="checkbox" checked={adaptive} onChange={(e) => setAdaptive(e.target.checked)} />
                <strong>Keep the stream alive</strong>
                <span className="dest__state">{live ? `${(liveRate / 1000).toFixed(1)} Mbps now` : adaptive ? "on" : "off"}</span>
              </label>
              <small className="deck__hint">
                On: if the connection cannot carry the stream, the rate steps down by a fifth and creeps back up when it is calm.
                Limit: {(rateCap / 1000).toFixed(1)} Mbps.
              </small>
            </div>

            <span className="eyebrow">DESTINATIONS</span>
            {PLATFORMS.map((p) => {
              const dest = status?.destinations.find((d) => d.platform === p.id);
              return (
                <div className="dest" key={p.id}>
                  <label className="dest__row">
                    <input type="checkbox" checked={picked[p.id]} disabled={live} onChange={(e) => setPicked({ ...picked, [p.id]: e.target.checked })} />
                    <strong>{p.label}</strong>
                    <span className={`dest__state dest__state--${dest?.state ?? "idle"}`}>
                      {dest?.state === "live" ? "live" : dest?.state === "error" ? "retrying" : dest?.keySet ? "key saved" : "no key"}
                    </span>
                  </label>
                  <div className="dest__key">
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={dest?.keySet ? "Saved. Paste a new key to replace" : "Paste stream key"}
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

            {!live ? (
              <button type="button" className="button button--primary golive__cta" disabled={busy || targets.length === 0} onClick={() => void goLive()}>
                Go live{targets.length ? ` to ${targets.map((t) => t.label).join(" + ")}` : ""}
              </button>
            ) : (
              <button type="button" className="button button--danger golive__cta" onClick={() => void endLive()}>
                End stream
              </button>
            )}
            {!live && targets.length === 0 && <small className="deck__hint">Save a stream key and tick a destination to go live.</small>}
            <div className="deck__stats">
              <span>
                <small>Out</small>
                <strong>{live ? `${meters.kbps} kbps` : "—"}</strong>
              </span>
              <span>
                <small>Sender</small>
                <strong>{live ? `${Math.round(status?.videoKbps ?? 0)} kbps` : "—"}</strong>
              </span>
              <span>
                <small>Dropped</small>
                <strong>{live ? `${status?.droppedKb ?? 0} KB` : "—"}</strong>
              </span>
            </div>
            {(problem || status?.lastError || enc.error || feed.error) && (
              <p className="golive__problem" role="alert">
                {problem || enc.error || feed.error || status?.lastError}
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
