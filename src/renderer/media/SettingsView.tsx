import { getBridge } from "../bridge";
import { formatDb, type UseMediaDevicesReturn } from "./useMediaDevices";

const bridge = getBridge();

interface SettingsViewProps {
  media: UseMediaDevicesReturn;
}

export function SettingsView({ media }: SettingsViewProps) {
  return (
    <section className="settings-view">
      <div className="settings-column">
        <div className="settings-card">
          <span className="panel-label">REAL DEVICES</span>
          <h2>Camera</h2>
          <label className="device-select">
            <span>Select camera</span>
            <select
              value={media.videoDevice}
              disabled={media.active || media.proofBusy}
              onChange={(event) => {
                media.stopPreview();
                media.setVideoDevice(event.target.value);
              }}
            >
              {media.videoDevices.map((device) => (
                <option key={device.name} value={device.name}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>

          <h2>Microphone</h2>
          <label className="device-select">
            <span>Select microphone</span>
            <select
              value={media.audioDevice}
              disabled={media.active || media.proofBusy}
              onChange={(event) => {
                media.stopPreview();
                media.setAudioDevice(event.target.value);
              }}
            >
              {media.audioDevices.map((device) => (
                <option key={device.name} value={device.name}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>

          <div className="settings-actions">
            <button
              type="button"
              className="media-primary"
              disabled={!media.electron || !media.videoDevice || !media.audioDevice || media.active}
              onClick={media.previewState === "active" ? media.stopPreview : media.startPreview}
            >
              {media.previewState === "active" ? "Stop preview" : "Start preview"}
            </button>
          </div>

          {media.error && (
            <div className="media-error" role="alert">
              <strong>MEDIA CHECK FAILED</strong>
              <span>{media.error}</span>
            </div>
          )}

          {media.micDb !== null && (
            <div className="mic-level">
              <span>Mic RMS: {formatDb(media.micDb)}</span>
              <div className="mic-level__track">
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, (media.micDb + 96) / 0.96))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="settings-card">
          <span className="panel-label">BOUNDED MEDIA PROOF</span>
          <h2>Record camera + mic</h2>
          <p className="media-copy">
            This diagnostic takes exclusive DirectShow control for 10 seconds and writes H.264 video
            plus AAC audio. It does not record Program.
          </p>
          <button
            type="button"
            className="media-primary"
            disabled={
              !media.electron ||
              !media.videoDevice ||
              !media.audioDevice ||
              media.proofBusy ||
              media.active
            }
            onClick={media.runProof}
          >
            {media.proofBusy ? "Recording…" : "Run 10-second A/V proof"}
          </button>
          {media.proof && (
            <div className={`proof-result ${media.proofReady ? "is-pass" : "is-fail"}`}>
              <div>
                <span>Video</span>
                <strong>{media.proof.video.codec ?? "missing"}</strong>
              </div>
              <div>
                <span>Audio</span>
                <strong>{media.proof.audio.codec ?? "missing"}</strong>
              </div>
              <div>
                <span>Mic</span>
                <strong>{media.proof.audio.signalDetected ? "DETECTED" : "NOT DETECTED"}</strong>
              </div>
              <button
                type="button"
                className="media-link"
                onClick={() => void bridge.openMediaArtifact(media.proof!.outputPath)}
              >
                Open file
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="settings-column">
        <div className="settings-card">
          <span className="panel-label">DESTINATION ROUTING</span>
          <h2>Twitch + Facebook</h2>
          <p className="media-copy">
            PulseCast will route one certified Program feed to Twitch, Facebook, or both with
            independent health and reconnect controls.
          </p>
          <div className="stream-health stream-health--routes">
            <div>
              <span>Twitch</span>
              <strong>UNAVAILABLE</strong>
            </div>
            <div>
              <span>Facebook</span>
              <strong>UNAVAILABLE</strong>
            </div>
          </div>
          <p className="transport-warning">
            Network output is disabled until Program video/audio binding and Windows Credential
            Manager are implemented and proven.
          </p>
        </div>
      </div>
    </section>
  );
}
