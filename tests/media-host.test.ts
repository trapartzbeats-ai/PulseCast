import { describe, expect, it } from "vitest";
import { parseMediaHostCapture, parseMediaHostProbe } from "../src/core/media-host";

function probe(candidateCount = 0) {
  return JSON.stringify({
    schema: "pulsecast.media-host-probe/v1",
    adapter: "MediaHostProcessAdapter/v1",
    version: "0.2.0",
    proofType: "real",
    processId: 100,
    capabilities: [
      { id: "window-discovery", proofType: "real", state: "ready" },
      { id: "window-capture", proofType: "real", state: "ready" },
      { id: "shared-texture-preview", proofType: "real", state: "ready" },
      { id: "process-audio", proofType: "unavailable", state: "unavailable" },
      { id: "program-composition", proofType: "unavailable", state: "unavailable" },
    ],
    remotePlay: {
      state: candidateCount > 0 ? "detected" : "not-detected",
      candidateCount,
    },
    candidates:
      candidateCount > 0
        ? [
            {
              windowId: "0x1234",
              processId: 42,
              title: "PS Remote Play",
              executableName: "RemotePlay.exe",
              className: "RemotePlayWindow",
              bounds: { x: 10, y: 20, width: 1280, height: 720 },
            },
          ]
        : [],
    capture: {
      schema: "pulsecast.media-host-capture/v1",
      proofType: "unavailable",
      state: "idle",
      windowId: null,
      frameCount: 0,
      width: 0,
      height: 0,
      lastFrameMonotonicMs: 0,
      error: null,
      preview: {
        proofType: "unavailable",
        state: "detached",
        presentedFrameCount: 0,
        width: 0,
        height: 0,
        sharedHandle: null,
        error: null,
      },
    },
  });
}

describe("Media Host process contract", () => {
  it("accepts real discovery and Windows Graphics Capture availability", () => {
    const parsed = parseMediaHostProbe(probe());
    expect(parsed.remotePlay.state).toBe("not-detected");
    expect(parsed.capabilities).toContainEqual({
      id: "window-capture",
      proofType: "real",
      state: "ready",
    });
  });

  it("accepts a matching Remote Play candidate", () => {
    const parsed = parseMediaHostProbe(probe(1));
    expect(parsed.candidates[0]?.executableName).toBe("RemotePlay.exe");
  });

  it("rejects a mismatched candidate count", () => {
    const invalid = JSON.parse(probe(1)) as {
      remotePlay: { candidateCount: number };
    };
    invalid.remotePlay.candidateCount = 2;
    expect(() => parseMediaHostProbe(JSON.stringify(invalid))).toThrow("candidate count");
  });

  it("rejects an unavailable label for the implemented capture adapter", () => {
    const invalid = JSON.parse(probe()) as {
      capabilities: Array<{ id: string; proofType: string; state: string }>;
    };
    invalid.capabilities[1] = {
      id: "window-capture",
      proofType: "unavailable",
      state: "unavailable",
    };
    expect(() => parseMediaHostProbe(JSON.stringify(invalid))).toThrow("invalid proof label");
  });

  it("requires a real frame before capture becomes active", () => {
    expect(() =>
      parseMediaHostCapture(
        JSON.stringify({
          schema: "pulsecast.media-host-capture/v1",
          proofType: "unavailable",
          state: "active",
          windowId: "0x1234",
          frameCount: 0,
          width: 1280,
          height: 720,
          lastFrameMonotonicMs: 0,
          error: null,
          preview: {
            proofType: "unavailable",
            state: "detached",
            presentedFrameCount: 0,
            width: 0,
            height: 0,
            sharedHandle: null,
            error: null,
          },
        }),
      ),
    ).toThrow("without a real frame");
  });

  it("requires a presented frame before preview becomes active", () => {
    const invalid = JSON.parse(probe()) as {
      capture: {
        preview: { state: string; proofType: string };
      };
    };
    invalid.capture.preview.state = "active";
    invalid.capture.preview.proofType = "unavailable";
    expect(() => parseMediaHostProbe(JSON.stringify(invalid))).toThrow(
      "active preview without a presented frame",
    );
  });
});
