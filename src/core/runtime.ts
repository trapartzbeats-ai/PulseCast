import type {
  CommandEnvelope,
  CommandResult,
  CoreState,
  RecoverySummary,
} from "../shared/contracts";
import { applyCommand } from "./reducer";
import { FileShowRepository } from "./repository";

export class CoreRuntime {
  private state: CoreState | null = null;
  private readonly resultsByIdempotencyKey = new Map<string, CommandResult>();

  constructor(private readonly repository: FileShowRepository) {}

  async initialize(): Promise<CoreState> {
    this.state = await this.repository.initialize();
    return this.getSnapshot();
  }

  getSnapshot(): CoreState {
    if (!this.state) throw new Error("Core runtime is not initialized.");
    return structuredClone(this.state);
  }

  async execute(command: CommandEnvelope): Promise<CommandResult> {
    if (!this.state) throw new Error("Core runtime is not initialized.");
    const prior = this.resultsByIdempotencyKey.get(command.idempotencyKey);
    if (prior) return structuredClone(prior);

    const outcome = applyCommand(this.state, command);
    if (outcome.result.status !== "accepted") return outcome.result;
    if (command.mode === "preview") return outcome.result;
    if (!outcome.event) throw new Error("Accepted command did not emit an event.");

    await this.repository.persistTransaction(outcome.state, command, outcome.event, outcome.result);
    this.state = outcome.state;
    this.resultsByIdempotencyKey.set(command.idempotencyKey, outcome.result);
    return structuredClone(outcome.result);
  }

  async createCheckpoint(): Promise<CoreState> {
    if (!this.state) throw new Error("Core runtime is not initialized.");
    this.state = await this.repository.writeCheckpoint(this.state, true);
    return this.getSnapshot();
  }

  async simulateInterruption(): Promise<RecoverySummary> {
    if (!this.state) throw new Error("Core runtime is not initialized.");
    const summary = await this.repository.simulateInterruption(this.state);
    this.state.runtime.interrupted = true;
    this.state.runtime.lastCheckpointAt = summary.checkpointAt;
    return summary;
  }

  getRecoverySummary(): Promise<RecoverySummary> {
    return this.repository.getRecoverySummary();
  }

  async recover(mode: "current" | "safe" | "last-known-good"): Promise<CoreState> {
    this.state = await this.repository.recover(mode);
    return this.getSnapshot();
  }

  async reset(): Promise<CoreState> {
    this.resultsByIdempotencyKey.clear();
    this.state = await this.repository.reset();
    return this.getSnapshot();
  }

  async exportShow(): Promise<{
    path: string;
    sha256: string;
    entries: string[];
  }> {
    if (!this.state) throw new Error("Core runtime is not initialized.");
    return this.repository.exportShow(this.state);
  }

  close(): Promise<void> {
    return this.repository.closeSession();
  }
}
