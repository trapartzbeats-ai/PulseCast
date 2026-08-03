/**
 * Shared hook for real-media device probing, preview, proof recording, and
 * FFmpeg stream lifecycle.  Extracted from RealMediaWorkspace so the same
 * logic can be used inside the production Studio without a separate route.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CameraMicProofResult,
  MediaBackendProbe,
  RealStreamHealth,
  StreamDestinationRequest,
} from "../../shared/contracts";
import { getBridge, isElectronBridge } from "../bridge";

const bridge = getBridge();

export const idleHealth: RealStreamHealth = {
  proofType: "real",
  adapter: "FfmpegDirectShowAdapter/v1",
  sessionId: null,
  lifecycle: "idle",
  pid: null,
  startedAt: null,
  reconnectAttempt: 0,
  frame: 0,
  outputTimeMs: 0,
  speed: "0x",
  audioLevelDb: null,
  destinations: [],
  lastError: "",
  credentialBoundary: "runtime-memory-and-child-command-line",
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function matchesNativeLabel(browserLabel: string, nativeName: string): boolean {
  const browser = normalized(browserLabel);
  const native = normalized(nativeName);
  return browser.includes(native) || native.includes(browser);
}

export function formatDb(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "\u2014" : `${value.toFixed(1)} dBFS`;
}

export function lifecycleIsActive(lifecycle: RealStreamHealth["lifecycle"]): boolean {
  return ["starting", "live", "reconnecting", "stopping"].includes(lifecycle);
}

export interface UseMediaDevicesReturn {
  probe: MediaBackendProbe | null;
  probeBusy: boolean;
  videoDevice: string;
  audioDevice: string;
  setVideoDevice: (v: string) => void;
  setAudioDevice: (v: string) => void;
  videoDevices: MediaBackendProbe["devices"];
  audioDevices: MediaBackendProbe["devices"];
  selectedEncoder: MediaBackendProbe["encoders"][number] | undefined;
  electron: boolean;
  refreshProbe: () => Promise<void>;

  // Camera browser preview
  previewState: "off" | "starting" | "active" | "failed";
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  previewStream: React.MutableRefObject<MediaStream | null>;
  audioContext: React.MutableRefObject<AudioContext | null>;
  micDb: number | null;
  startPreview: () => Promise<void>;
  stopPreview: () => void;

  // Display/window/tab capture
  displayPreviewState: "off" | "starting" | "active" | "failed";
  displayVideoElementRef: React.RefObject<HTMLVideoElement | null>;
  displayAudioElementRef: React.RefObject<HTMLAudioElement | null>;
  displayStream: React.MutableRefObject<MediaStream | null>;
  startDisplayCapture: () => Promise<void>;
  stopDisplayCapture: () => void;

  // Proof recording
  proof: CameraMicProofResult | null;
  proofBusy: boolean;
  proofReady: boolean;
  runProof: () => Promise<void>;

  // Stream lifecycle
  health: RealStreamHealth;
  active: boolean;
  startStream: (
    destinations: StreamDestinationRequest[],
    isBandwidthTest: boolean,
  ) => Promise<void>;
  stopStream: () => Promise<void>;
  error: string;
  setError: (e: string) => void;
  captureError: string;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [probe, setProbe] = useState<MediaBackendProbe | null>(null);
  const [probeBusy, setProbeBusy] = useState(true);
  const [videoDevice, setVideoDevice] = useState("");
  const [audioDevice, setAudioDevice] = useState("");
  const [previewState, setPreviewState] = useState<"off" | "starting" | "active" | "failed">("off");
  const [micDb, setMicDb] = useState<number | null>(null);
  const [proof, setProof] = useState<CameraMicProofResult | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [health, setHealth] = useState<RealStreamHealth>(idleHealth);
  const [error, setError] = useState("");
  const [displayPreviewState, setDisplayPreviewState] = useState<
    "off" | "starting" | "active" | "failed"
  >("off");
  const [captureError, setCaptureError] = useState("");

  const videoElementRef = useRef<HTMLVideoElement>(null);
  const previewStream = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrame = useRef<number | null>(null);
  const displayVideoElementRef = useRef<HTMLVideoElement>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const displayAudioElementRef = useRef<HTMLAudioElement | null>(null);

  const videoDevices = useMemo(
    () => probe?.devices.filter((d) => d.kind === "video") ?? [],
    [probe],
  );
  const audioDevices = useMemo(
    () => probe?.devices.filter((d) => d.kind === "audio") ?? [],
    [probe],
  );
  const selectedEncoder = probe?.encoders.find((e) => e.available);
  const electron = isElectronBridge();
  const active = lifecycleIsActive(health.lifecycle);
  const proofReady = Boolean(proof?.success && proof.audio.signalDetected);

  const refreshProbe = useCallback(async () => {
    setProbeBusy(true);
    setError("");
    try {
      const next = await bridge.probeRealMedia();
      setProbe(next);
      const firstVideo = next.devices.find((d) => d.kind === "video");
      const preferredAudio =
        next.devices.find((d) => d.kind === "audio" && /microphone array|realtek/i.test(d.name)) ??
        next.devices.find((d) => d.kind === "audio");
      setVideoDevice((c) => c || firstVideo?.name || "");
      setAudioDevice((c) => c || preferredAudio?.name || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Media probe failed.");
    } finally {
      setProbeBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshProbe();
    void bridge
      .getRealStreamHealth()
      .then(setHealth)
      .catch(() => undefined);
    const unsub = bridge.subscribeRealMedia((event) => {
      setHealth(event.health);
    });
    const timer = window.setInterval(() => {
      void bridge
        .getRealStreamHealth()
        .then(setHealth)
        .catch(() => undefined);
    }, 1000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [refreshProbe]);

  const stopPreview = useCallback(() => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    previewStream.current?.getTracks().forEach((t) => t.stop());
    previewStream.current = null;
    if (videoElementRef.current) videoElementRef.current.srcObject = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    setMicDb(null);
    setPreviewState("off");
  }, []);

  useEffect(() => stopPreview, [stopPreview]);

  const startPreview = useCallback(async () => {
    stopPreview();
    setPreviewState("starting");
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Chromium media-device access is unavailable.");
      const permStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const browserDevices = await navigator.mediaDevices.enumerateDevices();
      permStream.getTracks().forEach((t) => t.stop());

      const browserVideo = browserDevices.find(
        (d) => d.kind === "videoinput" && matchesNativeLabel(d.label, videoDevice),
      );
      const browserAudio = browserDevices.find(
        (d) => d.kind === "audioinput" && matchesNativeLabel(d.label, audioDevice),
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        video: browserVideo
          ? {
              deviceId: { exact: browserVideo.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : true,
        audio: browserAudio
          ? {
              deviceId: { exact: browserAudio.deviceId },
              echoCancellation: true,
              noiseSuppression: true,
            }
          : true,
      });
      previewStream.current = stream;
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        await videoElementRef.current.play();
      }

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;
      const samples = new Float32Array(analyser.fftSize);
      const updateMeter = () => {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const s of samples) energy += s * s;
        const rms = Math.sqrt(energy / samples.length);
        setMicDb(rms > 0 ? Math.max(-96, 20 * Math.log10(rms)) : -96);
        animationFrame.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
      setPreviewState("active");
    } catch (caught) {
      stopPreview();
      setPreviewState("failed");
      setError(
        caught instanceof Error ? caught.message : "Camera or microphone permission failed.",
      );
    }
  }, [audioDevice, stopPreview, videoDevice]);

  const runProof = useCallback(async () => {
    stopPreview();
    setProof(null);
    setProofBusy(true);
    setError("");
    try {
      const result = await bridge.recordCameraMicProof({
        videoDevice,
        audioDevice,
        width: 1280,
        height: 720,
        fps: 30,
        videoBitrateKbps: 4500,
        audioBitrateKbps: 160,
        encoder: "auto",
        durationMs: 10_000,
      });
      setProof(result);
      if (!result.success) setError(result.errorMessage);
      if (result.success && !result.audio.signalDetected) {
        setError(
          "The file contains an audio stream, but no usable microphone signal was measured. Speak during the next test.",
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A/V proof failed.");
    } finally {
      setProofBusy(false);
    }
  }, [audioDevice, stopPreview, videoDevice]);

  const startStream = useCallback(
    async (destinations: StreamDestinationRequest[], _isBandwidthTest: boolean) => {
      stopPreview();
      setError("");
      try {
        const next = await bridge.startRealStream({
          videoDevice,
          audioDevice,
          width: 1280,
          height: 720,
          fps: 30,
          videoBitrateKbps: 4500,
          audioBitrateKbps: 160,
          encoder: "auto",
          destinations,
          reconnect: {
            enabled: true,
            maxAttempts: 8,
            initialDelayMs: 1000,
            maximumDelayMs: 15_000,
          },
        });
        setHealth(next);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Stream start failed.");
      }
    },
    [audioDevice, stopPreview, videoDevice],
  );

  const stopStream = useCallback(async () => {
    setError("");
    try {
      setHealth(await bridge.stopRealStream());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stream stop failed.");
    }
  }, []);

  const stopDisplayCapture = useCallback(() => {
    displayStream.current?.getTracks().forEach((t) => t.stop());
    displayStream.current = null;
    if (displayVideoElementRef.current) {
      displayVideoElementRef.current.srcObject = null;
    }
    if (displayAudioElementRef.current) {
      displayAudioElementRef.current.pause();
      displayAudioElementRef.current.srcObject = null;
    }
    setDisplayPreviewState("off");
  }, []);

  const startDisplayCapture = useCallback(async () => {
    stopDisplayCapture();
    setDisplayPreviewState("starting");
    setCaptureError("");
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen/window capture is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      displayStream.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopDisplayCapture();
      });

      // Capture the selected microphone before activating preview
      if (audioDevice && navigator.mediaDevices?.getUserMedia) {
        (async () => {
          try {
            const bd = await navigator.mediaDevices.enumerateDevices();
            const ba = bd.find(
              (d) => d.kind === "audioinput" && matchesNativeLabel(d.label, audioDevice),
            );
            const ms = await navigator.mediaDevices.getUserMedia({
              audio: ba
                ? {
                    deviceId: { exact: ba.deviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                  }
                : { echoCancellation: true, noiseSuppression: true },
            });
            ms.getAudioTracks().forEach((t) => stream.addTrack(t));
          } catch {
            setCaptureError(
              "Display capture started, but the selected microphone could not be attached.",
            );
          }
        })();
      }

      setDisplayPreviewState("active");
    } catch (caught) {
      stopDisplayCapture();
      setDisplayPreviewState("failed");
      setCaptureError(caught instanceof Error ? caught.message : "Display capture failed.");
    }
  }, [audioDevice, stopDisplayCapture]);

  return {
    probe,
    probeBusy,
    videoDevice,
    audioDevice,
    setVideoDevice,
    setAudioDevice,
    videoDevices,
    audioDevices,
    selectedEncoder,
    electron,
    refreshProbe,
    previewState,
    videoElementRef,
    previewStream,
    audioContext: audioContextRef,
    micDb,
    startPreview,
    stopPreview,
    displayPreviewState,
    displayVideoElementRef,
    displayAudioElementRef,
    displayStream,
    startDisplayCapture,
    stopDisplayCapture,
    proof,
    proofBusy,
    proofReady,
    runProof,
    health,
    active,
    startStream,
    stopStream,
    error,
    setError,
    captureError,
  };
}
