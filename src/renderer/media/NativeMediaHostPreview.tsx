import { useEffect, useRef, useState } from "react";
import type { MediaHostCapture } from "../../shared/contracts";
import { getBridge, isElectronBridge } from "../bridge";

const bridge = getBridge();
const electron = isElectronBridge();

interface NativeMediaHostPreviewProps {
  capture?: MediaHostCapture | null;
  disabled?: boolean;
  variant?: "settings" | "canvas";
}

export function NativeMediaHostPreview({
  capture,
  disabled = false,
  variant = "settings",
}: NativeMediaHostPreviewProps) {
  const previewSurface = useRef<HTMLDivElement | null>(null);
  const [polledCapture, setPolledCapture] = useState<MediaHostCapture | null>(null);
  const effectiveCapture = capture === undefined ? polledCapture : capture;

  useEffect(() => {
    if (!electron || capture !== undefined) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const probe = await bridge.getMediaHostProbe();
        if (!disposed) setPolledCapture(probe.capture);
      } catch {
        if (!disposed) setPolledCapture(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [capture]);

  useEffect(() => {
    if (!electron) return;
    if (disabled || effectiveCapture?.state !== "active") {
      void bridge.setMediaHostPreview(null).catch(() => undefined);
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    const syncPreview = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        if (disposed) return;
        const surface = previewSurface.current;
        if (!surface) return;
        const rect = surface.getBoundingClientRect();
        const visible =
          rect.width >= 16 &&
          rect.height >= 16 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth;
        void bridge
          .setMediaHostPreview(
            visible ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          )
          .catch(() => undefined);
      });
    };

    const resizeObserver = new ResizeObserver(syncPreview);
    if (previewSurface.current) resizeObserver.observe(previewSurface.current);
    document.addEventListener("scroll", syncPreview, true);
    window.addEventListener("resize", syncPreview);
    syncPreview();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      document.removeEventListener("scroll", syncPreview, true);
      window.removeEventListener("resize", syncPreview);
      void bridge.setMediaHostPreview(null).catch(() => undefined);
    };
  }, [disabled, effectiveCapture?.state]);

  if (disabled || effectiveCapture?.state !== "active") return null;

  return (
    <div className={`native-preview-frame native-preview-frame--${variant}`}>
      <div className="native-preview-frame__header">
        <span>
          {variant === "canvas" ? "PLAYSTATION SOURCE PREVIEW" : "NATIVE SHARED-TEXTURE PREVIEW"}
        </span>
        <strong>
          {effectiveCapture.preview.presentedFrameCount > 0
            ? `${effectiveCapture.preview.presentedFrameCount} presented`
            : "Waiting for surface"}
        </strong>
      </div>
      <div className="native-preview-surface" ref={previewSurface}>
        <span>Media Host presentation surface</span>
      </div>
    </div>
  );
}
