import { describe, expect, it } from "vitest";
import { parseMediaHostProbe } from "../src/core/media-host";

function probe(candidateCount = 0) {
  return JSON.stringify({
    schema: "pulsecast.media-host-probe/v1",
    adapter: "MediaHostProcessAdapter/v1",
    version: "0.1.0",
    proofType: "real",
    processId: 100,
    capabilities: [
      { id: "window-discovery", proofType: "real", state: "ready" },
      { id: "window-capture", proofType: "unavailable", state: "unavailable" },
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
  });
}

describe("Media Host process contract", () => {
  it("accepts a real discovery probe while capture remains unavailable", () => {
    const parsed = parseMediaHostProbe(probe());
    expect(parsed.remotePlay.state).toBe("not-detected");
    expect(parsed.capabilities).toContainEqual({
      id: "window-capture",
      proofType: "unavailable",
      state: "unavailable",
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

  it("rejects a false real label for unavailable capture", () => {
    const invalid = JSON.parse(probe()) as {
      capabilities: Array<{ id: string; proofType: string; state: string }>;
    };
    invalid.capabilities[1] = {
      id: "window-capture",
      proofType: "real",
      state: "unavailable",
    };
    expect(() => parseMediaHostProbe(JSON.stringify(invalid))).toThrow("invalid proof label");
  });
});
