import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Pulse, PULSE_CORE_VERSION } from "pulse-engine";
import {
  createCommand,
  type AdapterStatus,
  type AudioBusId,
  type AudioChannel,
  type CommandKind,
  type CoreState,
  type NativeCaptureProof,
  type RecoverySummary,
  type SceneNode,
  type SourceDefinition,
  type Transform,
} from "../shared/contracts";
import { getBridge, isElectronBridge } from "./bridge";
import { DevicesPanel } from "./media/DevicesPanel";
import { NativeMediaHostPreview } from "./media/NativeMediaHostPreview";
import { useMediaDevices } from "./media/useMediaDevices";
import { SettingsView } from "./media/SettingsView";

type Route = "gate" | "studio" | "recovery";
type SaveState = "saved" | "saving" | "error";

const bridge = getBridge();

function formatTime(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "signal"
    | "layers"
    | "audio"
    | "route"
    | "shield"
    | "record"
    | "pulse"
    | "save"
    | "warning"
    | "check"
    | "monitor"
    | "camera"
    | "export";
  size?: number;
}) {
  const paths: Record<typeof name, ReactNode> = {
    signal: (
      <>
        <path d="M4 18v-4M9 18V9M14 18V5M19 18V2" />
        <path d="M3 22h18" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    audio: (
      <>
        <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M8 6h8M7 8l4 8M17 8l-4 8" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    record: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    pulse: (
      <>
        <path d="M3 12h4l2-7 4 14 2-7h6" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h12l2 2v16H5V3Z" />
        <path d="M8 3v6h8V3M8 21v-7h8v7" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    camera: (
      <>
        <path d="M4 7h4l2-3h4l2 3h4v13H4V7Z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    export: (
      <>
        <path d="M12 3v12M7 8l5-5 5 5" />
        <path d="M5 14v7h14v-7" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button className={`button button--${variant} ${className}`} type="button" {...props}>
      {children}
    </button>
  );
}

function TruthBanner({ electron }: { electron: boolean }) {
  return (
    <div className="truth-banner" role="note" data-testid="truth-banner">
      <span className="truth-banner__mark">
        <Icon name="shield" size={15} />
        REBOOT BASELINE
      </span>
      <span>
        {`Show, journal, recovery, and bounded media proofs are retained${
          electron ? "" : " in-memory"
        }. Program recording and network routing remain unavailable until their build gates pass.`}
      </span>
      <span className="offline-pill">
        <span className="offline-pill__dot" />
        OFFLINE
      </span>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="PulseCast Studio">
      <span className="brand__symbol">
        <Icon name="signal" size={21} />
      </span>
      <span>
        <strong>PULSECAST</strong>
        <small>STUDIO</small>
      </span>
    </div>
  );
}

function PulseGraphic({ trigger, compact = false }: { trigger: number; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pulse = new Pulse({
      motion: { reducedMotion, speed: 1, frameRate: 60 },
    });
    const element = root.current;
    if (element) {
      pulse
        .tween(element, {
          from: { opacity: 0, scale: reducedMotion ? 1 : 0.93 },
          to: { opacity: 1, scale: 1 },
          duration: reducedMotion ? 0 : 0.58,
          ease: "easeOutCubic",
        })
        .start();
    }
    return () => pulse.dispose();
  }, [trigger]);

  return (
    <div
      className={`pulse-graphic ${compact ? "pulse-graphic--compact" : ""}`}
      ref={root}
      data-testid="pulse-graphic"
    >
      <span className="pulse-graphic__eyebrow">PULSE CORE {PULSE_CORE_VERSION}</span>
      <strong>{compact ? "WE’LL BE RIGHT BACK" : "CREATE. BROADCAST. KEEP IT."}</strong>
      <span className="pulse-graphic__line" />
      <small>CANONICAL RUNTIME · REAL GRAPHIC LIFECYCLE</small>
    </div>
  );
}

function App() {
  const [state, setState] = useState<CoreState | null>(null);
  const stateRef = useRef<CoreState | null>(null);
  const [route, setRoute] = useState<Route>("gate");
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("Loading Foundation Show…");
  const [adapters, setAdapters] = useState<AdapterStatus[]>([]);
  const [recovery, setRecovery] = useState<RecoverySummary | null>(null);
  const [nativeProof, setNativeProof] = useState<NativeCaptureProof | null>(null);
  const electron = isElectronBridge();

  const commitState = useCallback((next: CoreState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    void Promise.all([bridge.getSnapshot(), bridge.getRecoverySummary(), bridge.probeAdapters()])
      .then(([snapshot, recoverySummary, adapterStatuses]) => {
        commitState(snapshot);
        setRecovery(recoverySummary);
        setAdapters(adapterStatuses);
        setRoute(recoverySummary.interrupted ? "recovery" : "gate");
        setMessage(
          recoverySummary.interrupted
            ? "Interrupted Foundation session detected."
            : "Foundation Show loaded.",
        );
      })
      .catch((error) => {
        setSaveState("error");
        setMessage(error instanceof Error ? error.message : "Startup failed.");
      });
  }, [commitState]);

  const execute = useCallback(
    async (kind: CommandKind, payload: Record<string, unknown>) => {
      const current = stateRef.current;
      if (!current) return false;
      setSaveState("saving");
      const result = await bridge.executeCommand(createCommand(current, kind, payload));
      if (result.status === "accepted" && result.snapshot) {
        commitState(result.snapshot);
        setSaveState("saved");
        setMessage(
          `${result.snapshot.show.name} saved at ${formatTime(result.snapshot.show.modifiedAt)}.`,
        );
        return true;
      }
      setSaveState("error");
      setMessage(result.violations[0]?.message ?? "Command was rejected.");
      if (result.status === "conflict") {
        commitState(await bridge.getSnapshot());
      }
      return false;
    },
    [commitState],
  );

  const resetShow = useCallback(async () => {
    if (!window.confirm("Reset the Foundation Show to its original state?")) return;
    commitState(await bridge.resetShow());
    setRoute("gate");
    setSaveState("saved");
    setNativeProof(null);
    setMessage("Foundation Show reset.");
  }, [commitState]);

  const createCheckpoint = useCallback(async () => {
    setSaveState("saving");
    const snapshot = await bridge.createCheckpoint();
    commitState(snapshot);
    setSaveState("saved");
    setMessage(
      `Last-known-good checkpoint saved at ${formatTime(snapshot.runtime.lastCheckpointAt)}.`,
    );
  }, [commitState]);

  const simulateInterruption = useCallback(async () => {
    if (
      !window.confirm(
        "This saves a real checkpoint and marks this Foundation session interrupted. It does not crash the computer or stop a real stream.",
      )
    ) {
      return;
    }
    const summary = await bridge.simulateInterruption();
    setRecovery(summary);
    commitState(await bridge.getSnapshot());
    setRoute("recovery");
  }, [commitState]);

  const recoverShow = useCallback(
    async (mode: "current" | "safe" | "last-known-good") => {
      const snapshot = await bridge.recover(mode);
      commitState(snapshot);
      setRecovery(await bridge.getRecoverySummary());
      setRoute("studio");
      setMessage(
        `${mode === "safe" ? "Safe mode opened" : "Show recovered"} at ${formatTime(snapshot.runtime.lastRecoveredAt)}.`,
      );
    },
    [commitState],
  );

  const exportShow = useCallback(async () => {
    try {
      const result = await bridge.exportShow();
      setMessage(
        `.pcast exported with ${result.entries.length} entries · ${result.sha256.slice(0, 12)}… · ${result.path}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }, []);

  const runNativeProof = useCallback(async () => {
    setMessage("Running a 1.2 second real display-recording proof…");
    setNativeProof(null);
    const result = await bridge.runNativeCaptureProof({
      durationMs: 1200,
      fps: 30,
    });
    setNativeProof(result);
    setMessage(
      result.success
        ? `Native display proof passed · ${(result.fileSizeBytes / 1024).toFixed(1)} KB · hardware encoder selection remains unverified.`
        : result.errorMessage,
    );
  }, []);

  if (!state) {
    return (
      <main className="loading-screen">
        <Brand />
        <div className="loading-orbit" />
        <p>{message}</p>
      </main>
    );
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <TruthBanner electron={electron} />
      {route === "gate" && (
        <ShowGate
          state={state}
          adapters={adapters}
          onOpen={() => setRoute("studio")}
          onReset={resetShow}
          onReviewRecovery={() => setRoute("recovery")}
          onOpenDevices={() => setDevicesOpen(true)}
          recovery={recovery}
        />
      )}

      {route === "studio" && (
        <Studio
          state={state}
          saveState={saveState}
          adapters={adapters}
          nativeProof={nativeProof}
          message={message}
          execute={execute}
          onBack={() => setRoute("gate")}
          onCheckpoint={createCheckpoint}
          onExport={exportShow}
          onSimulateInterruption={simulateInterruption}
          onRunNativeProof={runNativeProof}
          devicesOpen={devicesOpen}
          initialWorkspace={devicesOpen ? "settings" : undefined}
          onSetDevicesOpen={setDevicesOpen}
        />
      )}
      {route === "recovery" && (
        <RecoveryGate
          state={state}
          summary={recovery}
          onRecover={recoverShow}
          onBack={() => setRoute("gate")}
        />
      )}
    </div>
  );
}

function ShowGate({
  state,
  adapters,
  recovery,
  onOpen,
  onReset,
  onReviewRecovery,
  onOpenDevices,
}: {
  state: CoreState;
  adapters: AdapterStatus[];
  recovery: RecoverySummary | null;
  onOpen(): void;
  onReset(): void;
  onReviewRecovery(): void;
  onOpenDevices(): void;
}) {
  const readyAdapters = adapters.filter((adapter) => adapter.state === "ready");
  return (
    <main className="gate">
      <header className="gate__header">
        <Brand />
        <span className="version-pill">0.3 REBOOT</span>
      </header>
      <section className="gate__hero">
        <div className="gate__copy">
          <span className="section-kicker">PROGRAM-FIRST REBUILD</span>
          <h1>
            Build Program.
            <br />
            Route it everywhere.
          </h1>
          <p>
            The retained Foundation can test devices and recovery. Production output stays locked
            until the real Program compositor, audio graph, credential vault, and Twitch/Facebook
            routing are certified.
          </p>
        </div>
        <PulseGraphic trigger={state.runtime.pulseTrigger} />
      </section>
      <section className="show-card" aria-labelledby="show-card-title">
        <div className="show-card__main">
          <span className="show-card__icon">
            <Icon name="layers" size={24} />
          </span>
          <div>
            <span className="eyebrow">LOCAL SHOW</span>
            <h2 id="show-card-title">{state.show.name}</h2>
            <div className="show-card__facts">
              <span>{state.show.rundown.length} rundown cues</span>
              <span>{state.show.sources.length} sources</span>
              <span>{state.show.canvases.length} canvases</span>
              <span>Revision {state.show.revision}</span>
            </div>
          </div>
        </div>
        <div className="show-card__status">
          <span>Last saved</span>
          <strong>{formatTime(state.show.modifiedAt)}</strong>
          <span className="local-only">
            <Icon name="shield" size={14} /> Local-only foundation
          </span>
        </div>
        <div className="show-card__actions">
          {recovery?.interrupted ? (
            <Button variant="primary" onClick={onReviewRecovery}>
              Review recovery <span aria-hidden="true">→</span>
            </Button>
          ) : (
            <Button variant="primary" onClick={onOpen}>
              Open Studio <span aria-hidden="true">→</span>
            </Button>
          )}
          <Button variant="secondary" onClick={onOpenDevices}>
            Set up devices
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Reset show
          </Button>
        </div>
      </section>
      <section className="gate__proofs" aria-label="Foundation proof summary">
        <div>
          <span className="proof-number">01</span>
          <strong>Show integrity</strong>
          <small>Commands · revisions · checksums</small>
        </div>
        <div>
          <span className="proof-number">02</span>
          <strong>Recovery path</strong>
          <small>Journal · checkpoint · restore</small>
        </div>
        <div>
          <span className="proof-number">03</span>
          <strong>Adapter truth</strong>
          <small>{readyAdapters.length} ready · mock adapters labeled</small>
        </div>
      </section>
    </main>
  );
}

interface StudioProps {
  initialWorkspace?: string;
  state: CoreState;
  saveState: SaveState;
  adapters: AdapterStatus[];
  nativeProof: NativeCaptureProof | null;
  message: string;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
  onBack(): void;
  onCheckpoint(): void;
  onExport(): void;
  onSimulateInterruption(): void;
  onRunNativeProof(): void;
  devicesOpen: boolean;
  onSetDevicesOpen: (v: boolean) => void;
}
function Studio({
  state,
  saveState,
  adapters,
  nativeProof,
  message,
  execute,
  onBack,
  onCheckpoint,
  onExport,
  onSimulateInterruption,
  onRunNativeProof,
  devicesOpen,
  onSetDevicesOpen,
  initialWorkspace,
}: StudioProps) {
  const media = useMediaDevices();
  const [workspace, setWorkspace] = useState<string>(initialWorkspace ?? "production");
  const [canvasId, setCanvasId] = useState("canvas-horizontal");
  const [meterRunning, setMeterRunning] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const activeScene = state.show.scenes.find((scene) => scene.id === state.runtime.activeSceneId)!;
  const activeCanvas = state.show.canvases.find((canvas) => canvas.id === canvasId)!;
  const selectedNode = activeScene.nodes.find(
    (node) => node.sourceId === state.runtime.selectedSourceId,
  );
  const selectedSource = state.show.sources.find(
    (source) => source.id === state.runtime.selectedSourceId,
  );

  const advanceCue = async () => {
    const currentIndex = state.show.rundown.findIndex(
      (item) => item.id === state.runtime.activeRundownItemId,
    );
    const next = state.show.rundown[(currentIndex + 1) % state.show.rundown.length];
    await execute("scene.activate", { rundownItemId: next.id });
  };

  const runHealthTest = async () => {
    for (const destination of state.show.destinations) {
      await execute("destination.state", {
        destinationId: destination.id,
        state: "testing",
      });
      await execute("destination.state", {
        destinationId: destination.id,
        state: "healthy",
      });
    }
  };

  const receiveSupport = async () => {
    await execute("support.receive", {
      platform: "twitch",
      label: "TEST · Marcus cheered 500 Bits",
    });
  };

  return (
    <main className="studio">
      <header className="studio__header">
        <button className="brand-button" onClick={onBack} aria-label="Back to Show gate">
          <Brand />
        </button>
        <nav className="workspace-tabs" aria-label="Workspaces">
          <button
            className={workspace === "production" ? "is-active" : ""}
            onClick={() => setWorkspace("production")}
          >
            Production
          </button>
          <button
            className={workspace === "settings" ? "is-active" : ""}
            onClick={() => setWorkspace("settings")}
          >
            Settings
          </button>
          <button onClick={() => setDiagnosticsOpen(true)}>Diagnostics</button>
          <button disabled title="Planned after Foundation">
            Graphics <small>PLANNED</small>
          </button>
          <button disabled title="Planned after Foundation">
            Replay <small>PLANNED</small>
          </button>
        </nav>
        <div className="studio__header-status">
          <span className={`save-state save-state--${saveState}`} data-testid="save-state">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
                ? "Save failed"
                : `Saved · r${state.show.revision}`}
          </span>
          <Button variant="ghost" onClick={onCheckpoint}>
            <Icon name="save" size={15} /> Checkpoint
          </Button>
          <Button variant="ghost" onClick={onExport}>
            <Icon name="export" size={15} /> Export
          </Button>
        </div>
      </header>

      {workspace === "settings" ? (
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <SettingsView media={media} adapters={adapters} nativePreviewBlocked={diagnosticsOpen} />
        </div>
      ) : (
        <>
          {state.runtime.safeMode && (
            <div className="safe-mode-banner" role="status">
              <Icon name="shield" size={16} />
              SAFE MODE · Runtime sources are disabled; Show content is preserved.
            </div>
          )}

          <div className="studio-grid">
            <RundownPanel state={state} execute={execute} onAdvance={advanceCue} />
            <section className="stage-column">
              <div className="stage-toolbar">
                <div>
                  <span className="panel-label">CURRENT PREVIEW</span>
                  <strong>{activeScene.name}</strong>
                </div>
                <div className="canvas-switcher" role="group" aria-label="Preview canvas">
                  {state.show.canvases.map((canvas) => (
                    <button
                      key={canvas.id}
                      className={canvasId === canvas.id ? "is-active" : ""}
                      onClick={() => setCanvasId(canvas.id)}
                    >
                      {canvas.id === "canvas-horizontal" ? "16:9" : "9:16"}
                    </button>
                  ))}
                </div>
                <span
                  className={
                    media.previewState === "active" ? "real-media-badge" : "preview-off-badge"
                  }
                >
                  {media.previewState === "active" ? "REAL CAMERA + MIC" : "CAMERA PREVIEW OFF"}
                </span>
                <button
                  type="button"
                  className="media-toolbar-toggle"
                  onClick={() => onSetDevicesOpen(!devicesOpen)}
                  aria-label={devicesOpen ? "Close devices panel" : "Open devices panel"}
                  title="Devices"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  DEVICES
                </button>
              </div>
              <CanvasPreview
                state={state}
                sceneNodes={activeScene.nodes}
                canvas={activeCanvas}
                execute={execute}
                videoElementRef={media.videoElementRef}
                previewStream={media.previewStream}
                micDb={media.micDb}
                previewState={media.previewState}
                streamActive={media.active}
                selectedCamera={media.videoDevice}
                displayVideoElementRef={media.displayVideoElementRef}
                displayAudioElementRef={media.displayAudioElementRef}
                displayPreviewState={media.displayPreviewState}
                displayStream={media.displayStream}
                nativePreviewBlocked={diagnosticsOpen}
                onStartDisplayCapture={media.startDisplayCapture}
                onStopDisplayCapture={media.stopDisplayCapture}
                onStartPreview={media.startPreview}
                onStopPreview={media.stopPreview}
              />
              <div className="stage-footer">
                <span>
                  <Icon name="monitor" size={14} /> {activeCanvas.width} × {activeCanvas.height} ·{" "}
                  {activeCanvas.fps} FPS target
                </span>
                <span>
                  {media.previewState === "active"
                    ? `Previewing ${media.videoDevice}`
                    : media.previewState === "starting"
                      ? "Starting camera preview…"
                      : media.active
                        ? "Live encoder owns the selected camera"
                        : "Click CAMERA or DEVICES to start preview"}
                </span>
              </div>
            </section>
            <div className="inspector-column">
              <InspectorPanel
                state={state}
                canvasId={canvasId}
                node={selectedNode}
                source={selectedSource}
                execute={execute}
              />
              <DevicesPanel
                collapsed={!devicesOpen}
                onToggleCollapse={() => onSetDevicesOpen(!devicesOpen)}
                {...media}
              />
            </div>
          </div>

          <AudioConsole
            state={state}
            meterRunning={meterRunning}
            onToggleSignal={() => setMeterRunning((value) => !value)}
            execute={execute}
            micDb={media.micDb}
          />

          <section className="bottom-dock">
            <DestinationTray state={state} execute={execute} onRunHealthTest={runHealthTest} />
            <div className="support-card">
              <div className="dock-title">
                <div>
                  <span className="panel-label">SUPPORT EVENT</span>
                  <strong>Pulse trigger lab</strong>
                </div>
                <span className="test-tone-badge">LAB</span>
              </div>
              <div className="support-card__body">
                <Button variant="secondary" onClick={receiveSupport}>
                  <Icon name="pulse" size={15} /> Trigger 500 Bits
                </Button>
                <span>{state.runtime.supportEvents[0]?.label ?? "No test events yet."}</span>
              </div>
            </div>
            <div className="safety-card">
              <div className="dock-title">
                <div>
                  <span className="panel-label">RECOVERY</span>
                  <strong>Production safety</strong>
                </div>
                <Icon name="shield" size={18} />
              </div>
              <Button variant="danger" onClick={onSimulateInterruption}>
                Simulate interruption
              </Button>
            </div>
          </section>

          <footer className="status-bar">
            <span
              className="status-bar__message"
              role="status"
              aria-live="polite"
              data-testid="status-region"
            >
              {message}
            </span>
            <span className="status-bar__proof">
              <span className="status-dot status-dot--amber" />
              WORKSPACE FOUNDATION
            </span>
            <Button
              variant="secondary"
              className="diagnostics-button"
              onClick={() => setDiagnosticsOpen(true)}
            >
              Open diagnostics
            </Button>
            <div className="no-live">
              <span>NO NETWORK OUTPUT</span>
              <strong>GO LIVE UNAVAILABLE</strong>
            </div>
          </footer>
        </>
      )}
      {diagnosticsOpen && (
        <DiagnosticsDrawer
          adapters={adapters}
          nativeProof={nativeProof}
          onClose={() => setDiagnosticsOpen(false)}
          onRunNativeProof={onRunNativeProof}
        />
      )}
    </main>
  );
}

function RundownPanel({
  state,
  execute,
  onAdvance,
}: {
  state: CoreState;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
  onAdvance(): void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (index + offset + state.show.rundown.length) % state.show.rundown.length;
    const next = state.show.rundown[nextIndex];
    document.querySelector<HTMLButtonElement>(`[data-cue-id="${next.id}"]`)?.focus();
  };

  return (
    <aside className="rundown-panel" data-testid="rundown-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-label">SHOW FLOW</span>
          <h2>Rundown</h2>
        </div>
        <span className="item-count">{state.show.rundown.length}</span>
      </div>
      <div className="rundown-list" role="list">
        {state.show.rundown.map((item, index) => {
          const active = item.id === state.runtime.activeRundownItemId;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              data-cue-id={item.id}
              data-testid={`rundown-item-${item.id}`}
              className={`rundown-item ${active ? "is-active" : ""}`}
              onClick={() => execute("scene.activate", { rundownItemId: item.id })}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="rundown-item__number">{String(item.order).padStart(2, "0")}</span>
              <span className="rundown-item__copy">
                <strong>{item.name}</strong>
                <small>
                  {item.transition} · {item.audioSnapshotId.replace("snapshot-", "")}
                </small>
              </span>
              {active && <span className="rundown-item__active">PREVIEW</span>}
            </button>
          );
        })}
      </div>
      <Button variant="primary" className="advance-button" onClick={onAdvance}>
        Advance cue <span aria-hidden="true">↓</span>
      </Button>
      <div className="rundown-note">
        <Icon name="shield" size={15} />
        Scene changes are journaled. Nothing is broadcast.
      </div>
    </aside>
  );
}

function CanvasPreview({
  state,
  sceneNodes,
  canvas,
  execute,
  videoElementRef,
  previewState,
  streamActive,
  selectedCamera,
  previewStream,
  micDb,
  displayVideoElementRef,
  displayAudioElementRef,
  displayPreviewState,
  displayStream,
  nativePreviewBlocked,
  onStartDisplayCapture,
  onStopDisplayCapture,
  onStartPreview,
  onStopPreview,
}: {
  state: CoreState;
  sceneNodes: SceneNode[];
  canvas: CoreState["show"]["canvases"][number];
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  previewState: "off" | "starting" | "active" | "failed";
  streamActive: boolean;
  selectedCamera: string;
  previewStream: React.MutableRefObject<MediaStream | null>;
  micDb: number | null;
  displayVideoElementRef: React.RefObject<HTMLVideoElement | null>;
  displayAudioElementRef: React.RefObject<HTMLAudioElement | null>;
  displayPreviewState: "off" | "starting" | "active" | "failed";
  displayStream: React.MutableRefObject<MediaStream | null>;
  nativePreviewBlocked: boolean;
  onStartDisplayCapture: () => void;
  onStopDisplayCapture: () => void;
  onStartPreview: () => Promise<void>;
  onStopPreview: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Record<string, Transform>>({});

  // Position and attach camera stream matching the source-layer position
  useEffect(() => {
    const el = videoElementRef.current;
    if (previewState === "active" && previewStream.current && el) {
      el.srcObject = previewStream.current;
      const camNode = sceneNodes.find((n) => {
        const s = state.show.sources.find((src) => src.id === n.sourceId);
        return s?.type === "camera";
      });
      if (camNode) {
        const t = (draft[camNode.sourceId] ?? camNode.transforms[canvas.id]) || {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        };
        el.style.left = `${(t.x / canvas.width) * 100}%`;
        el.style.top = `${(t.y / canvas.height) * 100}%`;
        el.style.width = `${(t.width / canvas.width) * 100}%`;
        el.style.height = `${(t.height / canvas.height) * 100}%`;
      }
      el.style.position = "absolute";
      el.style.zIndex = "35";
      el.style.pointerEvents = "none";
      el.style.objectFit = "cover";
      el.style.visibility = "visible";
      el.play().catch(() => undefined);
    } else if (el) {
      el.srcObject = null;
      el.style.visibility = "hidden";
    }
  }, [previewState, sceneNodes, state.show.sources, canvas.id, canvas.width, canvas.height]);

  // Position and attach display stream matching the source-layer position
  useEffect(() => {
    const el = displayVideoElementRef.current;
    if (displayPreviewState === "active" && displayStream.current && el) {
      el.srcObject = displayStream.current;
      const dispNode = sceneNodes.find((n) => {
        const s = state.show.sources.find((src) => src.id === n.sourceId);
        return s?.type === "display";
      });
      if (dispNode) {
        const t = (draft[dispNode.sourceId] ?? dispNode.transforms[canvas.id]) || {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        };
        el.style.left = `${(t.x / canvas.width) * 100}%`;
        el.style.top = `${(t.y / canvas.height) * 100}%`;
        el.style.width = `${(t.width / canvas.width) * 100}%`;
        el.style.height = `${(t.height / canvas.height) * 100}%`;
      }
      el.style.position = "absolute";
      el.style.zIndex = "15";
      el.style.pointerEvents = "none";
      el.style.objectFit = "cover";
      el.style.visibility = "visible";
      el.play().catch(() => undefined);
    } else if (el) {
      el.srcObject = null;
      el.style.visibility = "hidden";
    }
  }, [displayPreviewState, sceneNodes, state.show.sources, canvas.id, canvas.width, canvas.height]);

  // Wire display audio to hidden audio element
  useEffect(() => {
    const el = displayAudioElementRef.current;
    if (displayPreviewState === "active" && displayStream.current && el) {
      el.srcObject = displayStream.current;
      el.play().catch(() => undefined);
    } else if (el) {
      el.srcObject = null;
    }
  }, [displayPreviewState]);

  const drag = useRef<{
    sourceId: string;
    startX: number;
    startY: number;
    original: Transform;
  } | null>(null);

  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    sourceId: string,
    transform: Transform,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      sourceId,
      startX: event.clientX,
      startY: event.clientY,
      original: transform,
    };
    void execute("source.select", { sourceId });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const dx = ((event.clientX - drag.current.startX) / bounds.width) * canvas.width;
    const dy = ((event.clientY - drag.current.startY) / bounds.height) * canvas.height;
    setDraft((current) => ({
      ...current,
      [drag.current!.sourceId]: {
        ...drag.current!.original,
        x: Math.round(drag.current!.original.x + dx),
        y: Math.round(drag.current!.original.y + dy),
      },
    }));
  };

  const endDrag = async (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const currentDrag = drag.current;
    const transform = draft[currentDrag.sourceId] ?? currentDrag.original;
    drag.current = null;
    await execute("source.move", {
      sceneId: state.runtime.activeSceneId,
      sourceId: currentDrag.sourceId,
      canvasId: canvas.id,
      transform,
    });
    setDraft((current) => {
      const next = { ...current };
      delete next[currentDrag.sourceId];
      return next;
    });
  };

  const moveWithKeyboard = async (
    event: KeyboardEvent<HTMLElement>,
    sourceId: string,
    transform: Transform,
  ) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    await execute("source.move", {
      sceneId: state.runtime.activeSceneId,
      sourceId,
      canvasId: canvas.id,
      transform: {
        ...transform,
        x: transform.x + direction[0] * amount,
        y: transform.y + direction[1] * amount,
      },
    });
  };

  return (
    <div
      className={`stage-viewport ${canvas.id === "canvas-vertical" ? "is-vertical" : ""}`}
      data-testid="preview-stage"
    >
      <div
        className="program-canvas"
        ref={stageRef}
        style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
      >
        <div className="canvas-grid" />
        <div className="safe-area" />
        <NativeMediaHostPreview variant="canvas" disabled={nativePreviewBlocked} />
        <video
          ref={videoElementRef}
          autoPlay
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            visibility: "hidden",
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
        <video
          ref={displayVideoElementRef}
          autoPlay
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            visibility: "hidden",
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
        <audio ref={displayAudioElementRef} autoPlay playsInline style={{ display: "none" }} />
        {[...sceneNodes]
          .sort((left, right) => left.zIndex - right.zIndex)
          .map((node) => {
            const source = state.show.sources.find((candidate) => candidate.id === node.sourceId);
            const transform = draft[node.sourceId] ?? node.transforms[canvas.id];
            if (!source || !transform?.visible) return null;
            const selected = source.id === state.runtime.selectedSourceId;
            const style: CSSProperties = {
              left: `${(transform.x / canvas.width) * 100}%`,
              top: `${(transform.y / canvas.height) * 100}%`,
              width: `${(transform.width / canvas.width) * 100}%`,
              height: `${(transform.height / canvas.height) * 100}%`,
              opacity: transform.opacity,
              transform: `rotate(${transform.rotation}deg)`,
            };
            const isCamera = source.type === "camera";
            const isDisplay = source.type === "display";
            const showRealPreview =
              isCamera && previewState === "active" && previewStream.current != null;
            const showDisplayCapture =
              isDisplay && displayPreviewState === "active" && displayStream.current != null;
            return (
              <div
                role="button"
                tabIndex={0}
                key={node.id}
                className={`source-layer source-layer--${source.type} ${showRealPreview ? "source-layer--real-preview" : ""} ${selected ? "is-selected" : ""}`}
                style={style}
                data-testid={`source-layer-${source.id}`}
                aria-label={`${source.name}, ${source.proofType} source. Use arrow keys to move.`}
                onClick={() => {
                  void execute("source.select", { sourceId: source.id });
                  if (isDisplay && displayPreviewState === "off") {
                    onStartDisplayCapture();
                  }
                }}
                onPointerDown={(event) => startDrag(event, source.id, transform)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onKeyDown={(event) => moveWithKeyboard(event, source.id, transform)}
              >
                {showRealPreview ? (
                  <div
                    className="camera-preview-layer"
                    style={{ position: "absolute", inset: 0, overflow: "hidden" }}
                  >
                    <div className="camera-preview-layer__label">LIVE · {selectedCamera}</div>
                  </div>
                ) : showDisplayCapture ? (
                  <div
                    className="camera-preview-layer"
                    style={{ position: "absolute", inset: 0, overflow: "hidden" }}
                  >
                    <div className="camera-preview-layer__label">SCREEN SHARING</div>
                  </div>
                ) : isDisplay && displayPreviewState === "off" ? (
                  <span
                    className="capture-activator"
                    style={{
                      position: "absolute",
                      inset: 0,
                      cursor: "pointer",
                      zIndex: 50,
                      display: "grid",
                      placeItems: "center",
                      alignContent: "center",
                      gap: "8px",
                      background: "transparent",
                      border: "none",
                      color: "#aeb9c4",
                    }}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="13" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                      <path d="M12 8v3M10.5 9.5h3" />
                    </svg>
                    <strong style={{ fontSize: "11px", letterSpacing: "0.08em", color: "#8a97a4" }}>
                      SHARE SCREEN
                    </strong>
                    <small
                      style={{
                        fontSize: "8px",
                        fontFamily: "Consolas, monospace",
                        color: "#4d5966",
                      }}
                    >
                      CLICK TO START
                    </small>
                  </span>
                ) : (
                  <SourceVisual
                    source={source}
                    trigger={state.runtime.pulseTrigger}
                    previewState={previewState}
                  />
                )}
                {selected && (
                  <>
                    <span className="selection-label">{source.name}</span>
                    <span className="handle handle--nw" />
                    <span className="handle handle--ne" />
                    <span className="handle handle--sw" />
                    <span className="handle handle--se" />
                  </>
                )}
              </div>
            );
          })}
        {streamActive && (
          <div className="canvas-overlay canvas-overlay--stream-active">
            <span className="canvas-overlay__badge">STREAMING TO NETWORK</span>
          </div>
        )}
        {state.runtime.safeMode && (
          <div className="canvas-overlay canvas-overlay--safe-mode">
            <span className="canvas-overlay__badge">SAFE MODE</span>
          </div>
        )}
        {previewState === "failed" && (
          <div className="canvas-overlay canvas-overlay--error">
            <span className="canvas-overlay__badge">PREVIEW FAILED</span>
          </div>
        )}
        <div className="media-toolbar">
          <button
            type="button"
            className={`media-toolbar__btn ${previewState === "active" ? "is-active" : ""}`}
            onClick={() => {
              if (previewState === "active") {
                onStopPreview();
              } else {
                void onStartPreview();
              }
            }}
            aria-label={previewState === "active" ? "Stop camera preview" : "Start camera preview"}
            title={previewState === "active" ? "Stop camera preview" : "Start camera preview"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            {previewState === "active" ? "CAMERA ON" : "CAMERA"}
          </button>
          <button
            type="button"
            className={`media-toolbar__btn ${displayPreviewState === "active" ? "is-active" : ""}`}
            onClick={() => {
              if (displayPreviewState === "active") {
                onStopDisplayCapture();
              } else {
                onStartDisplayCapture();
              }
            }}
            aria-label={displayPreviewState === "active" ? "Stop screen sharing" : "Share screen"}
            title={displayPreviewState === "active" ? "Stop screen sharing" : "Share screen"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            {displayPreviewState === "active" ? "SCREEN ON" : "SCREEN"}
          </button>
          <span
            className="media-toolbar__mic"
            title={micDb !== null ? `${micDb.toFixed(1)} dBFS` : "No mic"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span
              className={`media-toolbar__mic-bar ${micDb !== null && micDb > -30 ? "is-loud" : ""} ${micDb !== null && micDb > -60 ? "is-medium" : ""}`}
            />
            <small>{micDb !== null ? `${micDb.toFixed(0)} dB` : "—"}</small>
          </span>
        </div>
        <div
          className={`preview-truth-badge ${previewState === "active" ? "preview-truth-badge--real" : ""}`}
          data-testid="preview-truth-badge"
        />
      </div>
    </div>
  );
}

function SourceVisual({
  source,
  trigger,
  previewState,
}: {
  source: SourceDefinition;
  trigger: number;
  previewState: "off" | "starting" | "active" | "failed";
}) {
  if (source.type === "pulse-graphic") {
    return <PulseGraphic trigger={trigger} compact />;
  }
  if (source.type === "camera") {
    return (
      <span className="empty-source empty-source--camera">
        <span className="empty-source__icon">
          <Icon name="camera" size={22} />
        </span>
        <strong>CAMERA</strong>
        {previewState === "active" ? (
          <small>LIVE</small>
        ) : previewState === "starting" ? (
          <small>STARTING\u2026</small>
        ) : (
          <small>CLICK TO START</small>
        )}
      </span>
    );
  }
  return (
    <span className="empty-source empty-source--display">
      <span className="empty-source__icon">
        <Icon name="monitor" size={22} />
      </span>
      <strong>DISPLAY</strong>
      <small>NO CAPTURE</small>
    </span>
  );
}

function InspectorPanel({
  state,
  canvasId,
  node,
  source,
  execute,
}: {
  state: CoreState;
  canvasId: string;
  node: SceneNode | undefined;
  source: SourceDefinition | undefined;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
}) {
  const transform = node?.transforms[canvasId];
  const commit = (patch: Partial<Transform>) => {
    if (!source || !transform) return;
    void execute("source.move", {
      sceneId: state.runtime.activeSceneId,
      sourceId: source.id,
      canvasId,
      transform: { ...transform, ...patch },
    });
  };

  return (
    <aside className="inspector-panel" data-testid="inspector-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-label">SELECTED LAYER</span>
          <h2>Inspector</h2>
        </div>
        <Icon name="layers" size={18} />
      </div>
      {!source || !transform ? (
        <div className="empty-panel">Select a visual layer to inspect it.</div>
      ) : (
        <>
          <div className="source-summary">
            <span className={`source-summary__icon source-summary__icon--${source.type}`}>
              <Icon
                name={
                  source.type === "camera"
                    ? "camera"
                    : source.type === "pulse-graphic"
                      ? "pulse"
                      : "monitor"
                }
                size={19}
              />
            </span>
            <div>
              <strong>{source.name}</strong>
              <small>
                {source.type} · {source.proofType}
              </small>
            </div>
            <span className={`evidence evidence--${source.proofType}`}>{source.proofType}</span>
          </div>
          <div className="inspector-group">
            <div className="inspector-group__heading">
              <span>Position</span>
              <small>CANVAS PX</small>
            </div>
            <div className="number-grid">
              <NumberField
                label="X"
                value={transform.x}
                onCommit={(value) => commit({ x: value })}
              />
              <NumberField
                label="Y"
                value={transform.y}
                onCommit={(value) => commit({ y: value })}
              />
            </div>
          </div>
          <div className="inspector-group">
            <div className="inspector-group__heading">
              <span>Size</span>
              <small>PIXELS</small>
            </div>
            <div className="number-grid">
              <NumberField
                label="W"
                value={transform.width}
                min={40}
                onCommit={(value) => commit({ width: value })}
              />
              <NumberField
                label="H"
                value={transform.height}
                min={40}
                onCommit={(value) => commit({ height: value })}
              />
            </div>
          </div>
          <div className="inspector-group">
            <div className="inspector-group__heading">
              <span>Appearance</span>
              <small>SAFE</small>
            </div>
            <label className="range-row">
              <span>Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={transform.opacity}
                onChange={(event) => commit({ opacity: Number(event.target.value) })}
              />
              <output>{Math.round(transform.opacity * 100)}%</output>
            </label>
            <button
              className="visibility-toggle"
              aria-pressed={transform.visible}
              onClick={() => commit({ visible: !transform.visible })}
            >
              <span
                className={`status-dot ${transform.visible ? "status-dot--green" : "status-dot--gray"}`}
              />
              Visible on {canvasId === "canvas-horizontal" ? "Horizontal" : "Vertical"}
            </button>
          </div>
          <div className="inspector-hint">
            Drag the layer, use arrow keys, or enter exact values. Shift + Arrow moves 10 px.
          </div>
        </>
      )}
    </aside>
  );
}

function NumberField({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => setDraft(String(Math.round(value))), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onCommit(Math.max(min ?? -10000, parsed));
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        value={draft}
        min={min}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}

function AudioConsole({
  state,
  meterRunning,
  onToggleSignal,
  execute,
  micDb,
}: {
  state: CoreState;
  meterRunning: boolean;
  onToggleSignal(): void;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
  micDb: number | null;
}) {
  const sourceTypeByChannelId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ch of state.show.audio.channels) {
      const src = state.show.sources.find((s) => s.id === ch.sourceId);
      map[ch.id] = src?.type ?? "";
    }
    return map;
  }, [state.show.audio.channels, state.show.sources]);
  return (
    <section className="audio-console" data-testid="audio-dock">
      <div className="audio-console__heading">
        <div>
          <span className="panel-label">OURCONSOLE ROUTING MODEL</span>
          <h2>What should everyone hear?</h2>
        </div>
        <div className="synthetic-control">
          <span className="test-tone-badge">TEST TONE</span>
          <Button variant="ghost" onClick={onToggleSignal}>
            {meterRunning ? "Stop test tone" : "Run test tone"}
          </Button>
        </div>
      </div>
      <div className="audio-table">
        <div className="audio-table__header">
          <span>Source</span>
          <span>Level</span>
          <span>Gain</span>
          <span>Mute</span>
          {state.show.audio.buses.map((bus) => (
            <span key={bus.id}>
              <strong>{bus.creatorLabel}</strong>
              <small>{bus.id}</small>
            </span>
          ))}
          <span>Status</span>
        </div>
        {state.show.audio.channels.map((channel, index) => (
          <AudioChannelRow
            key={channel.id}
            channel={channel}
            health={state.runtime.audioHealth[channel.id]}
            meterRunning={meterRunning}
            meterIndex={index}
            execute={execute}
            micDb={sourceTypeByChannelId[channel.id] === "microphone" ? micDb : null}
          />
        ))}
      </div>
    </section>
  );
}

function AudioChannelRow({
  channel,
  health,
  meterRunning,
  meterIndex,
  execute,
  micDb,
}: {
  channel: AudioChannel;
  health: CoreState["runtime"]["audioHealth"][string];
  meterRunning: boolean;
  meterIndex: number;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
  micDb: number | null;
}) {
  const activeBars =
    micDb !== null ? Math.min(12, Math.max(0, Math.round((micDb + 60) / 5))) : null;
  return (
    <div className="audio-row" data-testid={`audio-channel-${channel.id}`}>
      <span className="channel-name">
        <span className="channel-icon">
          <Icon name="audio" size={16} />
        </span>
        <span>
          <strong>{channel.name}</strong>
          <small>{channel.processors.join(" · ")}</small>
        </span>
      </span>
      <span
        className="meter-cell"
        data-testid={`meter-${channel.id}`}
        aria-label={`${channel.name} level meter`}
      >
        <span
          className={`meter ${activeBars !== null ? "is-real" : meterRunning && health === "ok" && !channel.muted ? "is-running" : ""} ${health === "clipping" || (activeBars !== null && activeBars >= 11) ? "is-clipping" : ""}`}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--meter-index": index + meterIndex,
                  opacity: activeBars !== null ? (index < activeBars ? 1 : 0.12) : undefined,
                  transform:
                    activeBars !== null
                      ? index < activeBars
                        ? "scaleY(1)"
                        : "scaleY(0.25)"
                      : undefined,
                  transition: "opacity 80ms ease, transform 80ms ease",
                } as CSSProperties
              }
            />
          ))}
        </span>
        <small>
          {activeBars !== null ? `${micDb!.toFixed(0)} dB` : meterRunning ? "tone" : "idle"}
        </small>
      </span>
      <GainControl channel={channel} execute={execute} />
      <button
        className={`mute-button ${channel.muted ? "is-active" : ""}`}
        aria-pressed={channel.muted}
        onClick={() => execute("audio.mute", { channelId: channel.id, muted: !channel.muted })}
      >
        {channel.muted ? "MUTED" : "MUTE"}
      </button>
      {(["program", "monitor", "record"] as AudioBusId[]).map((busId) => (
        <button
          key={busId}
          className={`route-toggle ${channel.routes[busId] ? "is-active" : ""}`}
          aria-pressed={channel.routes[busId]}
          aria-label={`Route ${channel.name} to ${busId}`}
          onClick={() =>
            execute("audio.route", {
              channelId: channel.id,
              busId,
              enabled: !channel.routes[busId],
            })
          }
        >
          <span />
          {channel.routes[busId] ? "ON" : "OFF"}
        </button>
      ))}
      <span className={`health health--${health}`}>
        <span
          className={`status-dot ${health === "ok" ? "status-dot--green" : "status-dot--red"}`}
        />
        {health === "ok" ? "Synthetic OK" : health}
        <select
          aria-label={`Set ${channel.name} synthetic health`}
          value={health}
          onChange={(event) =>
            execute("audio.health", {
              channelId: channel.id,
              health: event.target.value,
            })
          }
        >
          <option value="ok">OK</option>
          <option value="clipping">Clip</option>
          <option value="silent">Silent</option>
          <option value="disconnected">Disconnected</option>
        </select>
      </span>
    </div>
  );
}

function GainControl({
  channel,
  execute,
}: {
  channel: AudioChannel;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
}) {
  const [draft, setDraft] = useState(channel.gainDb);
  useEffect(() => setDraft(channel.gainDb), [channel.gainDb]);
  return (
    <label className="gain-control">
      <input
        type="range"
        min="-60"
        max="12"
        step="0.5"
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={() => execute("audio.gain", { channelId: channel.id, gainDb: draft })}
        onKeyUp={() => execute("audio.gain", { channelId: channel.id, gainDb: draft })}
        aria-label={`${channel.name} gain`}
      />
      <output>{draft.toFixed(1)} dB</output>
    </label>
  );
}

function DestinationTray({
  state,
  execute,
  onRunHealthTest,
}: {
  state: CoreState;
  execute(kind: CommandKind, payload: Record<string, unknown>): Promise<boolean>;
  onRunHealthTest(): void;
}) {
  const healthy = Object.values(state.runtime.destinationStates).filter(
    (value) => value === "healthy",
  ).length;
  return (
    <div className="destination-tray" data-testid="destination-readiness">
      <div className="dock-title">
        <div>
          <span className="panel-label">DESTINATIONS FOUNDATION</span>
          <strong>
            {healthy} of {state.show.destinations.length} healthy
          </strong>
        </div>
        <Button variant="ghost" onClick={onRunHealthTest}>
          Run health
        </Button>
      </div>
      <div className="destination-list">
        {state.show.destinations.map((destination) => {
          const runtimeState = state.runtime.destinationStates[destination.id];
          return (
            <div className="destination-row" key={destination.id}>
              <span className={`platform-mark platform-mark--${destination.platform}`}>
                {destination.platform === "twitch" ? "T" : "f"}
              </span>
              <span>
                <strong>{destination.name}</strong>
                <small>{destination.canvasId.replace("canvas-", "")} · no account</small>
              </span>
              <span className={`destination-state destination-state--${runtimeState}`}>
                <span
                  className={`status-dot ${runtimeState === "healthy" ? "status-dot--green" : runtimeState === "failed" ? "status-dot--red" : "status-dot--gray"}`}
                />
                {runtimeState}
              </span>
              {destination.platform === "facebook" && (
                <button
                  className="inline-action"
                  onClick={() =>
                    execute("destination.state", {
                      destinationId: destination.id,
                      state: runtimeState === "failed" ? "reconnecting" : "failed",
                    })
                  }
                >
                  {runtimeState === "failed" ? "Reconnect" : "Fail"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticsDrawer({
  adapters,
  nativeProof,
  onClose,
  onRunNativeProof,
}: {
  adapters: AdapterStatus[];
  nativeProof: NativeCaptureProof | null;
  onClose(): void;
  onRunNativeProof(): void;
}) {
  const recorder = adapters.find((adapter) => adapter.id === "screen-recorder");
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="diagnostics-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnostics-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <span className="section-kicker">EVIDENCE, NOT OPTIMISM</span>
            <h2 id="diagnostics-title">Foundation diagnostics</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="adapter-grid">
          {adapters.map((adapter) => (
            <article className="adapter-card" key={adapter.id}>
              <div className="adapter-card__heading">
                <span
                  className={`status-dot status-dot--${adapter.state === "ready" ? "green" : adapter.state === "degraded" ? "amber" : "gray"}`}
                />
                <strong>{adapter.name}</strong>
                <span className={`evidence evidence--${adapter.proofType}`}>
                  {adapter.proofType}
                </span>
              </div>
              <p>{adapter.detail}</p>
              <div className="capabilities">
                {adapter.capabilities.map((capability) => (
                  <span key={capability}>{capability}</span>
                ))}
              </div>
              <small>{adapter.version ?? "No compatible version detected"}</small>
            </article>
          ))}
        </div>
        <section className="native-proof-card">
          <div>
            <span className="panel-label">REAL / BOUNDED NATIVE PROOF</span>
            <h3>Display → H.264 MP4</h3>
            <p>
              Runs the public ScreenRecorder CLI for 1.2 seconds, validates its result JSON and
              non-empty MP4, hashes the file, then asks ffprobe to inspect it. It does not prove
              camera composition, audio, a shared-texture path, or hardware encoder selection.
            </p>
          </div>
          <Button
            variant="primary"
            disabled={recorder?.state !== "ready"}
            onClick={onRunNativeProof}
          >
            <Icon name="record" size={17} /> Run native proof
          </Button>
        </section>
        {nativeProof && (
          <section className={`proof-result ${nativeProof.success ? "is-pass" : "is-fail"}`}>
            <div>
              <Icon name={nativeProof.success ? "check" : "warning"} size={24} />
              <span>
                <strong>
                  {nativeProof.success ? "NATIVE PROOF PASSED" : "NATIVE PROOF FAILED"}
                </strong>
                <small>
                  {nativeProof.adapter} · encoder selection {nativeProof.encoderSelection}
                </small>
              </span>
            </div>
            <dl>
              <div>
                <dt>Bytes</dt>
                <dd>{nativeProof.fileSizeBytes.toLocaleString()}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd>{nativeProof.sha256?.slice(0, 16) ?? "—"}</dd>
              </div>
              <div>
                <dt>Exit</dt>
                <dd>{nativeProof.exitCode}</dd>
              </div>
            </dl>
            <p>{nativeProof.success ? nativeProof.outputPath : nativeProof.errorMessage}</p>
          </section>
        )}
        <section className="open-gates">
          <span className="panel-label">OPEN PHASE 0 GATES</span>
          <ul>
            <li>
              <span>—</span> Real camera + display GPU composition
            </li>
            <li>
              <span>—</span> WASAPI microphone and desktop routing
            </li>
            <li>
              <span>—</span> Verified hardware encoder selection
            </li>
            <li>
              <span>—</span> RTMPS transport and reconnect
            </li>
            <li>
              <span>—</span> Isolated host continuity
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function RecoveryGate({
  state,
  summary,
  onRecover,
  onBack,
}: {
  state: CoreState;
  summary: RecoverySummary | null;
  onRecover(mode: "current" | "safe" | "last-known-good"): void;
  onBack(): void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="recovery-gate">
      <header className="gate__header">
        <Brand />
        <span className="version-pill version-pill--warning">RECOVERY MODE</span>
      </header>
      <section className="recovery-hero">
        <span className="recovery-hero__icon">
          <Icon name="shield" size={38} />
        </span>
        <div>
          <span className="section-kicker">INTERRUPTED FOUNDATION SESSION</span>
          <h1 tabIndex={-1} ref={heading}>
            Your Show state is still here.
          </h1>
          <p>
            The interruption is simulated. Restoration uses the stored Show checkpoint and recovery
            journal; no real stream or computer process was crashed.
          </p>
        </div>
      </section>
      <section className="recovery-card">
        <div className="recovery-column">
          <span className="panel-label">RECOVERED DATA</span>
          <ul className="recovery-list recovery-list--pass">
            <li>
              <Icon name="check" size={17} /> Show and {state.show.rundown.length}-cue rundown
            </li>
            <li>
              <Icon name="check" size={17} /> Scene and source transforms
            </li>
            <li>
              <Icon name="check" size={17} /> Audience, Monitor, and Record routes
            </li>
            <li>
              <Icon name="check" size={17} /> Mock destination configuration
            </li>
          </ul>
        </div>
        <div className="recovery-column">
          <span className="panel-label">NEEDS ATTENTION</span>
          <ul className="recovery-list recovery-list--warning">
            <li>
              <Icon name="warning" size={17} /> Mock connections reset to Idle
            </li>
            <li>
              <Icon name="warning" size={17} /> Simulated source hosts require preview restart
            </li>
          </ul>
        </div>
        <div className="recovery-metrics">
          <div>
            <span>Checkpoint</span>
            <strong>{formatTime(summary?.checkpointAt ?? state.runtime.lastCheckpointAt)}</strong>
          </div>
          <div>
            <span>Checksum</span>
            <strong className="success-text">{summary?.checksumStatus ?? "verified"}</strong>
          </div>
          <div>
            <span>Journal entries</span>
            <strong>{summary?.journalEntries ?? state.show.revision}</strong>
          </div>
          <div>
            <span>Skipped</span>
            <strong>{summary?.skippedEntries ?? 0}</strong>
          </div>
        </div>
      </section>
      <section className="recovery-actions">
        <Button variant="primary" onClick={() => onRecover("current")}>
          Open recovered Show
        </Button>
        <Button variant="secondary" onClick={() => onRecover("safe")}>
          Open in safe mode
        </Button>
        <Button variant="ghost" onClick={() => onRecover("last-known-good")}>
          Restore last known good
        </Button>
        <button className="text-action" onClick={onBack}>
          Back to Show gate
        </button>
      </section>
    </main>
  );
}

export default App;
