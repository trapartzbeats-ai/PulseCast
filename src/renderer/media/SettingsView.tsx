import { useEffect, useMemo, useState } from "react";
import { getBridge } from "../bridge";
import type {
  AdapterStatus,
  MediaHostProbe,
  MediaHostProgramTransform,
} from "../../shared/contracts";
import { formatDb, type UseMediaDevicesReturn } from "./useMediaDevices";
import { NativeMediaHostPreview } from "./NativeMediaHostPreview";

const bridge = getBridge();

interface SettingsViewProps {
  media: UseMediaDevicesReturn;
  adapters: AdapterStatus[];
  nativePreviewBlocked?: boolean;
}

export function SettingsView({ media, adapters, nativePreviewBlocked = false }: SettingsViewProps) {
  const mediaHost = adapters.find((adapter) => adapter.id === "media-host");
  const [mediaHostProbe, setMediaHostProbe] = useState<MediaHostProbe | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [programTransform, setProgramTransform] = useState<MediaHostProgramTransform>({
    x: 160,
    y: 90,
    width: 1600,
    height: 900,
  });

  useEffect(() => {
    if (!media.electron) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const probe = await bridge.getMediaHostProbe();
        if (disposed) return;
        setMediaHostProbe(probe);
        setSelectedWindowId((current) => current || probe.candidates[0]?.windowId || "");
      } catch (error) {
        if (!disposed) {
          setCaptureError(error instanceof Error ? error.message : "Media Host probe failed.");
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [media.electron]);

  const selectedCandidate = useMemo(
    () => mediaHostProbe?.candidates.find((candidate) => candidate.windowId === selectedWindowId),
    [mediaHostProbe, selectedWindowId],
  );
  const capture = mediaHostProbe?.capture;
  useEffect(() => {
    if (capture?.program) setProgramTransform(capture.program.transform);
  }, [
    capture?.program.transform.x,
    capture?.program.transform.y,
    capture?.program.transform.width,
    capture?.program.transform.height,
  ]);
  const captureLabel =
    capture?.state === "active" && capture.proofType === "real"
      ? "REAL"
      : capture?.state === "starting"
        ? "STARTING"
        : capture?.state === "stalled"
          ? "STALLED"
          : capture?.state === "failed"
            ? "FAILED"
            : capture?.state === "stopped"
              ? "STOPPED"
              : "READY";

  const startCapture = async () => {
    if (!selectedWindowId) return;
    setCaptureBusy(true);
    setCaptureError("");
    try {
      await bridge.startMediaHostCapture(selectedWindowId);
      setMediaHostProbe(await bridge.getMediaHostProbe());
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "Window capture failed.");
    } finally {
      setCaptureBusy(false);
    }
  };

  const stopCapture = async () => {
    setCaptureBusy(true);
    setCaptureError("");
    try {
      await bridge.stopMediaHostCapture();
      setMediaHostProbe(await bridge.getMediaHostProbe());
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "Window capture did not stop.");
    } finally {
      setCaptureBusy(false);
    }
  };

  const applyProgramTransform = async () => {
    setCaptureBusy(true);
    setCaptureError("");
    try {
      await bridge.setMediaHostProgramTransform(programTransform);
      setMediaHostProbe(await bridge.getMediaHostProbe());
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "Program transform failed.");
    } finally {
      setCaptureBusy(false);
    }
  };

  return (
    <section className="settings-view">
      <div className="settings-column">
        <div className="settings-card">
          <span className="panel-label">PLAYSTATION SOURCE</span>
          <h2>Official PS Remote Play</h2>
          <p className="media-copy">
            {mediaHostProbe
              ? mediaHostProbe.candidates.length > 0
                ? `${mediaHostProbe.candidates.length} matching PS Remote Play window candidate(s) detected.`
                : "Real Windows discovery and capture are ready; no PS Remote Play window is currently detected."
              : (mediaHost?.detail ?? "Native Media Host discovery has not completed yet.")}
          </p>
          {mediaHostProbe && mediaHostProbe.candidates.length > 0 && (
            <label className="device-select">
              <span>Select Remote Play window</span>
              <select
                value={selectedWindowId}
                disabled={captureBusy || capture?.state === "active"}
                onChange={(event) => setSelectedWindowId(event.target.value)}
              >
                {mediaHostProbe.candidates.map((candidate) => (
                  <option key={candidate.windowId} value={candidate.windowId}>
                    {candidate.title} · {candidate.bounds.width} × {candidate.bounds.height}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="stream-health stream-health--routes">
            <div>
              <span>Discovery</span>
              <strong>{mediaHost?.proofType === "real" ? "REAL" : "UNAVAILABLE"}</strong>
            </div>
            <div>
              <span>Capture</span>
              <strong>{captureLabel}</strong>
            </div>
          </div>
          {capture?.proofType === "real" && (
            <div className="proof-result is-pass">
              <div>
                <span>{capture.state === "active" ? "Frames" : "Last capture frames"}</span>
                <strong>{capture.frameCount}</strong>
              </div>
              <div>
                <span>Resolution</span>
                <strong>
                  {capture.width} × {capture.height}
                </strong>
              </div>
              <div>
                <span>{capture.state === "active" ? "Source" : "Last source"}</span>
                <strong>{selectedCandidate?.executableName || "Remote Play"}</strong>
              </div>
              <div>
                <span>Preview</span>
                <strong>
                  {capture.preview.state === "active"
                    ? "NATIVE"
                    : capture.preview.state.toUpperCase()}
                </strong>
              </div>
              <div>
                <span>Program video</span>
                <strong>{capture.program.state.toUpperCase()}</strong>
              </div>
              <div>
                <span>Composed frames</span>
                <strong>{capture.program.composedFrameCount}</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>
                  {capture.program.outputWidth} × {capture.program.outputHeight}
                </strong>
              </div>
              <div>
                <span>Source transform</span>
                <strong>
                  {capture.program.transform.x}, {capture.program.transform.y} ·{" "}
                  {capture.program.transform.width} × {capture.program.transform.height}
                </strong>
              </div>
            </div>
          )}
          {capture?.program && (
            <div className="program-transform-panel">
              <div className="program-transform-panel__header">
                <span>1920 × 1080 source transform</span>
                <strong>ONE-SOURCE COMPOSITOR</strong>
              </div>
              <div className="program-transform-grid">
                {(["x", "y", "width", "height"] as const).map((field) => (
                  <label key={field}>
                    <span>{field}</span>
                    <input
                      type="number"
                      min={field === "x" || field === "y" ? 0 : 1}
                      max={field === "x" || field === "width" ? 1920 : 1080}
                      value={programTransform[field]}
                      disabled={captureBusy}
                      onChange={(event) =>
                        setProgramTransform((current) => ({
                          ...current,
                          [field]: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="media-link"
                disabled={captureBusy || capture.state !== "active"}
                onClick={() => void applyProgramTransform()}
              >
                Apply native transform
              </button>
            </div>
          )}
          <NativeMediaHostPreview capture={capture} disabled={nativePreviewBlocked} />
          <div className="settings-actions">
            {capture?.state === "active" || capture?.state === "stalled" ? (
              <button
                type="button"
                className="media-primary"
                disabled={captureBusy}
                onClick={() => void stopCapture()}
              >
                {captureBusy ? "Stopping…" : "Stop capture"}
              </button>
            ) : (
              <button
                type="button"
                className="media-primary"
                disabled={!media.electron || !selectedWindowId || captureBusy}
                onClick={() => void startCapture()}
              >
                {captureBusy ? "Starting…" : "Capture Remote Play"}
              </button>
            )}
          </div>
          {(captureError || capture?.error) && (
            <div className="media-error" role="alert">
              <strong>CAPTURE FAILED</strong>
              <span>{captureError || capture?.error}</span>
            </div>
          )}
          <p className="transport-warning">
            Capture and Program video are marked REAL only after native D3D11 frames arrive and are
            composed. This is a one-source video test path; camera layering, Program audio, and
            destination output remain unavailable.
          </p>
        </div>

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
