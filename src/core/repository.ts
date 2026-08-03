import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CommandEnvelope,
  CommandResult,
  CoreState,
  DomainEvent,
  RecoverySummary,
} from "../shared/contracts";
import { createDefaultState } from "./default-show";
import { applyCommand } from "./reducer";

interface JournalEntry {
  schema: "pulsecast.journal-entry/v1";
  command: CommandEnvelope;
  event: DomainEvent;
  resultingRevision: number;
  recordedAt: string;
}

interface RecoveryMarker {
  schema: "pulsecast.recovery-marker/v1";
  interruptedAt: string;
  reason: "unclean-shutdown" | "simulated";
  checkpointAt: string | null;
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.previous`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tempPath, content, "utf8");

  if (await exists(filePath)) {
    await rm(backupPath, { force: true });
    await rename(filePath, backupPath);
  }

  try {
    await rename(tempPath, filePath);
    await rm(backupPath, { force: true });
  } catch (error) {
    if (await exists(backupPath)) {
      await rename(backupPath, filePath);
    }
    throw error;
  }
}

export class FileShowRepository {
  readonly rootDir: string;
  private readonly showDir: string;
  private readonly statePath: string;
  private readonly journalPath: string;
  private readonly lockPath: string;
  private readonly recoveryMarkerPath: string;
  private readonly checkpointPath: string;
  private readonly lastKnownGoodPath: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
    this.showDir = path.join(this.rootDir, "shows", "foundation-flagship");
    this.statePath = path.join(this.showDir, "working-state.json");
    this.journalPath = path.join(this.showDir, "recovery", "journal.jsonl");
    this.lockPath = path.join(this.showDir, "recovery", "session.lock");
    this.recoveryMarkerPath = path.join(this.showDir, "recovery", "interrupted.json");
    this.checkpointPath = path.join(this.showDir, "recovery", "checkpoint.json");
    this.lastKnownGoodPath = path.join(this.showDir, "recovery", "last-known-good.json");
  }

  async initialize(): Promise<CoreState> {
    await mkdir(path.join(this.showDir, "recovery"), { recursive: true });
    let state = await this.readState();
    if (!state) {
      state = createDefaultState();
      await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
      await this.writeCheckpoint(state, true);
    }

    state = await this.replayMissingJournalEntries(state);
    if (await exists(this.lockPath)) {
      const marker: RecoveryMarker = {
        schema: "pulsecast.recovery-marker/v1",
        interruptedAt: new Date().toISOString(),
        reason: "unclean-shutdown",
        checkpointAt: state.runtime.lastCheckpointAt,
      };
      state.runtime.interrupted = true;
      await atomicWrite(this.recoveryMarkerPath, JSON.stringify(marker, null, 2));
      await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
    }

    await atomicWrite(
      this.lockPath,
      JSON.stringify({
        schema: "pulsecast.session-lock/v1",
        openedAt: new Date().toISOString(),
        pid: process.pid,
      }),
    );
    return state;
  }

  async closeSession(): Promise<void> {
    await rm(this.lockPath, { force: true });
  }

  async persistTransaction(
    state: CoreState,
    command: CommandEnvelope,
    event: DomainEvent,
    result: CommandResult,
  ): Promise<void> {
    const entry: JournalEntry = {
      schema: "pulsecast.journal-entry/v1",
      command,
      event,
      resultingRevision: result.revision,
      recordedAt: new Date().toISOString(),
    };
    await appendFile(this.journalPath, `${JSON.stringify(entry)}\n`, "utf8");
    await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
  }

  async writeCheckpoint(state: CoreState, promote: boolean): Promise<CoreState> {
    const checkpointed = structuredClone(state);
    checkpointed.runtime.lastCheckpointAt = new Date().toISOString();
    const payload = JSON.stringify(checkpointed, null, 2);
    const envelope = JSON.stringify(
      {
        schema: "pulsecast.checkpoint/v1",
        sha256: sha256(payload),
        state: checkpointed,
      },
      null,
      2,
    );
    await atomicWrite(this.checkpointPath, envelope);
    if (promote) {
      await atomicWrite(this.lastKnownGoodPath, envelope);
    }
    await atomicWrite(this.statePath, JSON.stringify(checkpointed, null, 2));
    return checkpointed;
  }

  async simulateInterruption(state: CoreState): Promise<RecoverySummary> {
    const checkpointed = await this.writeCheckpoint(state, false);
    const marker: RecoveryMarker = {
      schema: "pulsecast.recovery-marker/v1",
      interruptedAt: new Date().toISOString(),
      reason: "simulated",
      checkpointAt: checkpointed.runtime.lastCheckpointAt,
    };
    checkpointed.runtime.interrupted = true;
    await atomicWrite(this.recoveryMarkerPath, JSON.stringify(marker, null, 2));
    await atomicWrite(this.statePath, JSON.stringify(checkpointed, null, 2));
    return this.getRecoverySummary();
  }

  async getRecoverySummary(): Promise<RecoverySummary> {
    const marker = await this.readJson<RecoveryMarker>(this.recoveryMarkerPath);
    const checkpoint = await this.readCheckpoint(this.checkpointPath);
    const journalEntries = await this.readJournal();
    return {
      interrupted: Boolean(marker),
      checkpointAt: marker?.checkpointAt ?? null,
      checksumStatus: checkpoint ? "verified" : "missing",
      journalEntries: journalEntries.length,
      skippedEntries: 0,
    };
  }

  async recover(mode: "current" | "safe" | "last-known-good"): Promise<CoreState> {
    let state: CoreState | null;
    if (mode === "last-known-good") {
      state = await this.readCheckpoint(this.lastKnownGoodPath);
    } else {
      state = (await this.readCheckpoint(this.checkpointPath)) ?? (await this.readState());
    }
    if (!state) throw new Error("No valid recovery state is available.");

    state.runtime.interrupted = false;
    state.runtime.safeMode = mode === "safe";
    state.runtime.lastRecoveredAt = new Date().toISOString();
    for (const destinationId of Object.keys(state.runtime.destinationStates)) {
      state.runtime.destinationStates[destinationId] = "idle";
    }
    await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
    await rm(this.recoveryMarkerPath, { force: true });
    return state;
  }

  async reset(): Promise<CoreState> {
    const state = createDefaultState();
    await atomicWrite(this.statePath, JSON.stringify(state, null, 2));
    await atomicWrite(this.journalPath, "");
    await rm(this.recoveryMarkerPath, { force: true });
    await rm(this.checkpointPath, { force: true });
    await rm(this.lastKnownGoodPath, { force: true });
    return this.writeCheckpoint(state, true);
  }

  async exportShow(state: CoreState): Promise<{
    path: string;
    sha256: string;
    entries: string[];
  }> {
    const exportDir = path.join(this.rootDir, "exports");
    await mkdir(exportDir, { recursive: true });
    const exportPath = path.join(exportDir, "PulseCast-Foundation-Demo.pcast");
    const zip = new AdmZip();

    const showJson = JSON.stringify(state.show, null, 2);
    const rundownJson = JSON.stringify(state.show.rundown, null, 2);
    const manifest = {
      format: "pulsecast-show",
      formatVersion: "1.0.0",
      showId: state.show.id,
      name: state.show.name,
      createdAt: state.show.createdAt,
      modifiedAt: state.show.modifiedAt,
      savedRevision: state.show.revision,
      applicationVersion: "0.1.0-foundation",
      requiredModules: state.show.requiredModules,
      proofBoundary: "Control-plane foundation only; no live media or destination credentials.",
    };
    const manifestJson = JSON.stringify(manifest, null, 2);
    const recoveryJson = JSON.stringify(
      {
        lastCheckpointAt: state.runtime.lastCheckpointAt,
        lastRecoveredAt: state.runtime.lastRecoveredAt,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    const checksums = {
      "manifest.json": sha256(manifestJson),
      "show.json": sha256(showJson),
      "rundown.json": sha256(rundownJson),
      "recovery/summary.json": sha256(recoveryJson),
    };

    zip.addFile("manifest.json", Buffer.from(manifestJson));
    zip.addFile("show.json", Buffer.from(showJson));
    zip.addFile("rundown.json", Buffer.from(rundownJson));
    zip.addFile("recovery/summary.json", Buffer.from(recoveryJson));
    zip.addFile("checksums.json", Buffer.from(JSON.stringify(checksums, null, 2)));
    zip.writeZip(exportPath);

    const file = await readFile(exportPath);
    return {
      path: exportPath,
      sha256: sha256(file),
      entries: zip.getEntries().map((entry) => entry.entryName),
    };
  }

  private async readState(): Promise<CoreState | null> {
    const primary = await this.readJson<CoreState>(this.statePath);
    if (primary?.show?.schema === "pulsecast.show/v1") return primary;
    return this.readJson<CoreState>(`${this.statePath}.previous`);
  }

  private async readCheckpoint(filePath: string): Promise<CoreState | null> {
    const envelope = await this.readJson<{
      schema: string;
      sha256: string;
      state: CoreState;
    }>(filePath);
    if (!envelope?.state || envelope.schema !== "pulsecast.checkpoint/v1") {
      return null;
    }
    const payload = JSON.stringify(envelope.state, null, 2);
    return sha256(payload) === envelope.sha256 ? envelope.state : null;
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as T;
    } catch {
      return null;
    }
  }

  private async readJournal(): Promise<JournalEntry[]> {
    try {
      const raw = await readFile(this.journalPath, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as JournalEntry];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  private async replayMissingJournalEntries(state: CoreState): Promise<CoreState> {
    let recovered = state;
    const entries = (await this.readJournal())
      .filter((entry) => entry.resultingRevision > state.show.revision)
      .sort((left, right) => left.resultingRevision - right.resultingRevision);
    for (const entry of entries) {
      const replayCommand = {
        ...entry.command,
        baseRevision: recovered.show.revision,
      };
      const outcome = applyCommand(recovered, replayCommand);
      if (outcome.result.status === "accepted") recovered = outcome.state;
    }
    if (recovered.show.revision !== state.show.revision) {
      recovered.runtime.interrupted = true;
      await atomicWrite(this.statePath, JSON.stringify(recovered, null, 2));
    }
    return recovered;
  }
}
