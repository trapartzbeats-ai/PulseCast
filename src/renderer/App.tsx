import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type AdapterStatus,
  type CoreState,
  type RecoverySummary,
} from "../shared/contracts";
import { getBridge, isElectronBridge } from "./bridge";
import { GoLiveView } from "./golive/GoLiveView";
import { StudioLive } from "./studio/StudioLive";

type Route = "gate" | "golive" | "studio" | "recovery";

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
        0.4 STUDIO
      </span>
      <span>
        {electron
          ? "PS5 video, camera, microphone and the stream encoder are real. Twitch and Facebook output is real once you save a stream key."
          : "Browser preview: PS5, camera and streaming only work in the PulseCast app."}
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

function App() {
  const [state, setState] = useState<CoreState | null>(null);
  const stateRef = useRef<CoreState | null>(null);
  const [route, setRoute] = useState<Route>("gate");
  const [message, setMessage] = useState("Loading Foundation Show…");
  const [adapters, setAdapters] = useState<AdapterStatus[]>([]);
  const [recovery, setRecovery] = useState<RecoverySummary | null>(null);
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
        setMessage(error instanceof Error ? error.message : "Startup failed.");
      });
  }, [commitState]);

  const resetShow = useCallback(async () => {
    if (!window.confirm("Reset the Foundation Show to its original state?")) return;
    commitState(await bridge.resetShow());
    setRoute("gate");
    setMessage("Foundation Show reset.");
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
          onGoLive={() => setRoute("golive")}
          onReset={resetShow}
          onReviewRecovery={() => setRoute("recovery")}
          recovery={recovery}
        />
      )}

      {route === "golive" && <GoLiveView onBack={() => setRoute("gate")} />}

      {route === "studio" && <StudioLive onBack={() => setRoute("gate")} />}
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
  onGoLive,
}: {
  state: CoreState;
  adapters: AdapterStatus[];
  recovery: RecoverySummary | null;
  onGoLive(): void;
  onOpen(): void;
  onReset(): void;
  onReviewRecovery(): void;
}) {
  const readyAdapters = adapters.filter((adapter) => adapter.state === "ready");
  return (
    <main className="gate">
      <header className="gate__header">
        <Brand />
        <span className="version-pill">0.3 REBOOT</span>
      </header>
      <section className="launch">
        <div className="launch__copy">
          <span className="section-kicker">PS5 → TWITCH · FACEBOOK</span>
          <h1>
            Your PS5.
            <br />
            <em>On air.</em>
          </h1>
          <p>
            No capture card, no second encode. PulseCast pulls the PS5’s own video over Remote Play
            and sends that exact stream out, so weak internet goes further.
          </p>
          <div className="launch__actions">
            <Button variant="primary" className="launch__cta" onClick={onGoLive}>
              Go Live from PS5 <span aria-hidden="true">→</span>
            </Button>
            <span className="launch__note">
              Live video: <b>real</b> once the PS5 connects · stream keys stay encrypted on this PC
            </span>
          </div>
        </div>
        <button type="button" className="launch__screen" onClick={onGoLive} aria-label="Open Go Live">
          <span className="launch__screen-glow" />
          <span className="launch__screen-label">PS5 SCREEN</span>
          <span className="launch__screen-play">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5-13-7.5Z" />
            </svg>
          </span>
          <span className="launch__screen-foot">720p · 1080p · H.264 as sent</span>
        </button>
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
