import { getBridge } from "../bridge";
import { formatDb, type UseMediaDevicesReturn } from "./useMediaDevices";

const bridge = getBridge();

interface DevicesPanelProps extends UseMediaDevicesReturn {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function DevicesPanel(props: DevicesPanelProps) {
  if (props.collapsed) {
    return (
      <aside className="devices-panel devices-panel--collapsed" data-testid="devices-panel">
        <button
          className="devices-panel__toggle"
          onClick={props.onToggleCollapse}
          title="Open devices panel"
        >
          <span className="devices-panel__indicator" />
          <strong>DEVICES</strong>
          <small>{props.probe?.proofType === "real" ? "REAL" : "OFFLINE"}</small>
        </button>
      </aside>
    );
  }

  return (
    <aside className="devices-panel" data-testid="devices-panel">
      <div className="devices-panel__header">
        <strong>Devices</strong>
        <button
          className="devices-panel__toggle"
          onClick={props.onToggleCollapse}
          title="Close devices panel"
        >
          X
        </button>
        <button
          className="media-refresh devices-panel__refresh"
          type="button"
          onClick={props.refreshProbe}
          disabled={props.probeBusy}
        >
          {props.probeBusy ? "Probing…" : "Refresh"}
        </button>
      </div>

      {props.error && (
        <div className="media-error" role="alert">
          <strong>MEDIA CHECK FAILED</strong>
          <span>{props.error}</span>
        </div>
      )}

      <section className="devices-panel__runtime">
        <div>
          <span>FFmpeg proof</span>
          <strong>{props.probe?.proofType === "real" ? "REAL" : "UNAVAILABLE"}</strong>
        </div>
        <div>
          <span>Encoder probe</span>
          <strong>{props.selectedEncoder?.name ?? "—"}</strong>
        </div>
        <div>
          <span>Program output</span>
          <strong>UNAVAILABLE</strong>
        </div>
      </section>

      <label className="device-select">
        <span>Camera</span>
        <select
          value={props.videoDevice}
          disabled={props.active || props.proofBusy}
          onChange={(event) => {
            props.stopPreview();
            props.setVideoDevice(event.target.value);
            props.setError("");
          }}
        >
          {props.videoDevices.map((device) => (
            <option key={device.name} value={device.name}>
              {device.name}
            </option>
          ))}
        </select>
      </label>

      <label className="device-select">
        <span>Microphone</span>
        <select
          value={props.audioDevice}
          disabled={props.active || props.proofBusy}
          onChange={(event) => {
            props.stopPreview();
            props.setAudioDevice(event.target.value);
            props.setError("");
          }}
        >
          {props.audioDevices.map((device) => (
            <option key={device.name} value={device.name}>
              {device.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="media-primary"
        disabled={!props.electron || !props.videoDevice || !props.audioDevice || props.active}
        onClick={props.previewState === "active" ? props.stopPreview : props.startPreview}
      >
        {props.previewState === "active" ? "Stop preview" : "Start preview"}
      </button>

      <div className="mic-level">
        <span>Mic RMS: {formatDb(props.micDb)}</span>
        <div className="mic-level__track">
          <span
            style={{
              width: `${Math.max(0, Math.min(100, ((props.micDb ?? -96) + 96) / 0.96))}%`,
            }}
          />
        </div>
      </div>

      <button
        type="button"
        className="media-primary"
        disabled={
          !props.electron ||
          !props.videoDevice ||
          !props.audioDevice ||
          props.proofBusy ||
          props.active
        }
        onClick={props.runProof}
      >
        {props.proofBusy ? "Recording…" : "Run 10s A/V proof"}
      </button>

      {props.proof && (
        <div className={`proof-result ${props.proofReady ? "is-pass" : "is-fail"}`}>
          <div>
            <span>Video</span>
            <strong>{props.proof.video.codec ?? "missing"}</strong>
          </div>
          <div>
            <span>Audio</span>
            <strong>{props.proof.audio.codec ?? "missing"}</strong>
          </div>
          <div>
            <span>Mic</span>
            <strong>{props.proof.audio.signalDetected ? "DETECTED" : "NOT DETECTED"}</strong>
          </div>
          <button
            type="button"
            className="media-link"
            onClick={() => void bridge.openMediaArtifact(props.proof!.outputPath)}
          >
            Open
          </button>
        </div>
      )}

      <section className="dest-config">
        <span className="devices-panel__section-title">DESTINATION ROUTING</span>
        <p className="media-copy">
          Twitch and Facebook routes are unavailable until the Program media path and credential
          vault are certified.
        </p>
      </section>
    </aside>
  );
}
