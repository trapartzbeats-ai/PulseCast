import AdmZip from "adm-zip";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultState } from "../src/core/default-show";
import { applyCommand } from "../src/core/reducer";
import { FileShowRepository } from "../src/core/repository";
import { CoreRuntime } from "../src/core/runtime";
import { createCommand } from "../src/shared/contracts";

const tempDirectories: string[] = [];

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pulsecast-test-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  for (const directory of tempDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("command model", () => {
  it("accepts a revisioned scene activation and emits an immutable event", () => {
    const state = createDefaultState("2026-07-28T12:00:00.000Z");
    const command = createCommand(state, "scene.activate", {
      rundownItemId: "cue-host-desktop",
    });

    const outcome = applyCommand(state, command);

    expect(outcome.result.status).toBe("accepted");
    expect(outcome.state.show.revision).toBe(1);
    expect(outcome.state.runtime.activeSceneId).toBe("scene-host-desktop");
    expect(outcome.event?.type).toBe("scene.activated");
    expect(state.runtime.activeSceneId).toBe("scene-intro");
  });

  it("rejects stale revisions without mutating state", () => {
    const state = createDefaultState();
    const command = {
      ...createCommand(state, "audio.mute", {
        channelId: "channel-mic",
        muted: true,
      }),
      baseRevision: 12,
    };

    const outcome = applyCommand(state, command);

    expect(outcome.result.status).toBe("conflict");
    expect(outcome.result.violations[0]?.code).toBe("STALE_REVISION");
    expect(outcome.state).toEqual(state);
  });

  it("keeps mock destination failure isolated", () => {
    const state = createDefaultState();
    const command = createCommand(state, "destination.state", {
      destinationId: "destination-facebook",
      state: "failed",
    });

    const outcome = applyCommand(state, command);

    expect(outcome.state.runtime.destinationStates["destination-facebook"]).toBe("failed");
    expect(outcome.state.runtime.destinationStates["destination-twitch"]).toBe("idle");
  });
});

describe("persistent Foundation runtime", () => {
  it("persists commands once for repeated idempotency keys", async () => {
    const root = await tempDirectory();
    const runtime = new CoreRuntime(new FileShowRepository(root));
    const initial = await runtime.initialize();
    const command = createCommand(initial, "audio.route", {
      channelId: "channel-mic",
      busId: "monitor",
      enabled: false,
    });

    const first = await runtime.execute(command);
    const repeated = await runtime.execute(command);

    expect(first.status).toBe("accepted");
    expect(repeated.revision).toBe(first.revision);
    expect(runtime.getSnapshot().show.revision).toBe(1);
    expect(
      runtime.getSnapshot().show.audio.channels.find((channel) => channel.id === "channel-mic")
        ?.routes.monitor,
    ).toBe(false);
    await runtime.close();
  });

  it("restores a checkpoint and resets operational destinations", async () => {
    const root = await tempDirectory();
    const runtime = new CoreRuntime(new FileShowRepository(root));
    let state = await runtime.initialize();
    await runtime.execute(
      createCommand(state, "scene.activate", {
        rundownItemId: "cue-host-desktop",
      }),
    );
    state = runtime.getSnapshot();
    await runtime.execute(
      createCommand(state, "destination.state", {
        destinationId: "destination-twitch",
        state: "healthy",
      }),
    );

    const summary = await runtime.simulateInterruption();
    const recovered = await runtime.recover("current");

    expect(summary.interrupted).toBe(true);
    expect(recovered.runtime.activeSceneId).toBe("scene-host-desktop");
    expect(recovered.runtime.destinationStates["destination-twitch"]).toBe("idle");
    expect(recovered.runtime.lastRecoveredAt).toBeTruthy();
    await runtime.close();
  });

  it("exports a checksummed ZIP-compatible .pcast", async () => {
    const root = await tempDirectory();
    const runtime = new CoreRuntime(new FileShowRepository(root));
    await runtime.initialize();

    const result = await runtime.exportShow();
    const zip = new AdmZip(result.path);
    const checksums = JSON.parse(zip.readAsText("checksums.json")) as Record<string, string>;
    const manifest = JSON.parse(zip.readAsText("manifest.json")) as {
      format: string;
      proofBoundary: string;
    };

    expect(path.extname(result.path)).toBe(".pcast");
    expect(result.sha256).toHaveLength(64);
    expect(result.entries).toContain("show.json");
    expect(Object.keys(checksums)).toContain("manifest.json");
    expect(manifest.format).toBe("pulsecast-show");
    expect(manifest.proofBoundary).toContain("no live media");
    expect((await readFile(result.path)).byteLength).toBeGreaterThan(1000);
    await runtime.close();
  });
});
