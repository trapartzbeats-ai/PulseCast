import {
  commandEnvelopeSchema,
  type AudioBusId,
  type CommandEnvelope,
  type CommandResult,
  type CoreState,
  type DestinationRuntimeState,
  type DomainEvent,
  type Transform,
  type Violation,
} from "../shared/contracts";

export interface ApplyCommandOutcome {
  state: CoreState;
  result: CommandResult;
  event: DomainEvent | null;
}

function rejected(
  commandId: string,
  revision: number,
  violation: Violation,
  status: "rejected" | "conflict" = "rejected",
): ApplyCommandOutcome {
  return {
    state: null as unknown as CoreState,
    event: null,
    result: {
      schema: "pulsecast.command-result/v1",
      commandId,
      status,
      revision,
      events: [],
      violations: [violation],
    },
  };
}

function stringPayload(command: CommandEnvelope, key: string, allowed?: readonly string[]): string {
  const value = command.payload[key];
  if (typeof value !== "string" || (allowed && !allowed.includes(value))) {
    throw new Error(`Invalid ${key}`);
  }
  return value;
}

function numberPayload(command: CommandEnvelope, key: string): number {
  const value = command.payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${key}`);
  }
  return value;
}

function booleanPayload(command: CommandEnvelope, key: string): boolean {
  const value = command.payload[key];
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${key}`);
  }
  return value;
}

export function applyCommand(
  current: CoreState,
  commandInput: CommandEnvelope,
): ApplyCommandOutcome {
  const parsed = commandEnvelopeSchema.safeParse(commandInput);
  if (!parsed.success) {
    const outcome = rejected(commandInput.commandId ?? "unknown", current.show.revision, {
      code: "COMMAND_SCHEMA_INVALID",
      path: parsed.error.issues[0]?.path.join(".") ?? "command",
      severity: "error",
      message: parsed.error.issues[0]?.message ?? "Command is invalid",
    });
    outcome.state = current;
    return outcome;
  }

  const command = parsed.data;
  if (command.showId !== current.show.id) {
    const outcome = rejected(command.commandId, current.show.revision, {
      code: "SHOW_MISMATCH",
      path: "showId",
      severity: "error",
      message: "The command targets a different Show.",
    });
    outcome.state = current;
    return outcome;
  }

  if (command.baseRevision !== current.show.revision) {
    const outcome = rejected(
      command.commandId,
      current.show.revision,
      {
        code: "STALE_REVISION",
        path: "baseRevision",
        severity: "error",
        message: `Expected revision ${current.show.revision}.`,
      },
      "conflict",
    );
    outcome.state = current;
    return outcome;
  }

  const next = structuredClone(current);
  let eventType: string = command.kind;
  let eventPayload: Record<string, unknown> = { ...command.payload };

  try {
    switch (command.kind) {
      case "scene.activate": {
        const cueId = stringPayload(command, "rundownItemId");
        const cue = next.show.rundown.find((item) => item.id === cueId);
        if (!cue || !next.show.scenes.some((scene) => scene.id === cue.sceneId)) {
          throw new Error("Rundown item or scene is unavailable");
        }
        next.runtime.activeRundownItemId = cue.id;
        next.runtime.activeSceneId = cue.sceneId;
        next.runtime.selectedSourceId =
          next.show.scenes.find((scene) => scene.id === cue.sceneId)?.nodes.at(-1)?.sourceId ??
          null;
        eventType = "scene.activated";
        eventPayload = { rundownItemId: cue.id, sceneId: cue.sceneId };
        break;
      }
      case "source.select": {
        const sourceId = stringPayload(command, "sourceId");
        if (!next.show.sources.some((source) => source.id === sourceId)) {
          throw new Error("Source is unavailable");
        }
        next.runtime.selectedSourceId = sourceId;
        eventType = "source.selected";
        break;
      }
      case "source.move": {
        const sceneId = stringPayload(command, "sceneId");
        const sourceId = stringPayload(command, "sourceId");
        const canvasId = stringPayload(command, "canvasId");
        const scene = next.show.scenes.find((candidate) => candidate.id === sceneId);
        const node = scene?.nodes.find((candidate) => candidate.sourceId === sourceId);
        const existing = node?.transforms[canvasId];
        if (!scene || !node || !existing) {
          throw new Error("Source transform is unavailable");
        }
        const patch = command.payload.transform;
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
          throw new Error("Invalid transform");
        }
        const transform = { ...existing, ...(patch as Partial<Transform>) };
        transform.width = Math.max(40, Math.round(transform.width));
        transform.height = Math.max(40, Math.round(transform.height));
        transform.x = Math.round(transform.x);
        transform.y = Math.round(transform.y);
        transform.rotation = Math.max(-180, Math.min(180, transform.rotation));
        transform.opacity = Math.max(0, Math.min(1, transform.opacity));
        node.transforms[canvasId] = transform;
        next.runtime.selectedSourceId = sourceId;
        eventType = "source.moved";
        eventPayload = { sceneId, sourceId, canvasId, transform };
        break;
      }
      case "audio.route": {
        const channelId = stringPayload(command, "channelId");
        const busId = stringPayload(command, "busId", [
          "program",
          "monitor",
          "record",
        ]) as AudioBusId;
        const enabled = booleanPayload(command, "enabled");
        const channel = next.show.audio.channels.find((candidate) => candidate.id === channelId);
        if (!channel) throw new Error("Audio channel is unavailable");
        channel.routes[busId] = enabled;
        eventType = "audio.routed";
        break;
      }
      case "audio.gain": {
        const channelId = stringPayload(command, "channelId");
        const gainDb = Math.max(-60, Math.min(12, numberPayload(command, "gainDb")));
        const channel = next.show.audio.channels.find((candidate) => candidate.id === channelId);
        if (!channel) throw new Error("Audio channel is unavailable");
        channel.gainDb = Math.round(gainDb * 10) / 10;
        eventType = "audio.gain-changed";
        eventPayload = { channelId, gainDb: channel.gainDb };
        break;
      }
      case "audio.mute": {
        const channelId = stringPayload(command, "channelId");
        const muted = booleanPayload(command, "muted");
        const channel = next.show.audio.channels.find((candidate) => candidate.id === channelId);
        if (!channel) throw new Error("Audio channel is unavailable");
        channel.muted = muted;
        eventType = "audio.mute-changed";
        break;
      }
      case "audio.health": {
        const channelId = stringPayload(command, "channelId");
        const health = stringPayload(command, "health", [
          "ok",
          "clipping",
          "silent",
          "disconnected",
        ]);
        if (!next.show.audio.channels.some((channel) => channel.id === channelId)) {
          throw new Error("Audio channel is unavailable");
        }
        next.runtime.audioHealth[channelId] = health as CoreState["runtime"]["audioHealth"][string];
        eventType = `audio.${health}`;
        break;
      }
      case "destination.state": {
        const destinationId = stringPayload(command, "destinationId");
        const state = stringPayload(command, "state", [
          "idle",
          "testing",
          "healthy",
          "failed",
          "reconnecting",
        ]) as DestinationRuntimeState;
        if (!next.show.destinations.some((destination) => destination.id === destinationId)) {
          throw new Error("Destination is unavailable");
        }
        next.runtime.destinationStates[destinationId] = state;
        eventType =
          state === "failed"
            ? "destination.failed"
            : state === "healthy"
              ? "destination.connected"
              : "destination.state-changed";
        break;
      }
      case "support.receive": {
        const platform = stringPayload(command, "platform", ["twitch", "facebook"]) as
          "twitch" | "facebook";
        const label = stringPayload(command, "label");
        const event = {
          id: `support_${command.commandId}`,
          platform,
          label,
          proofType: "mock" as const,
          occurredAt: command.issuedAt,
        };
        next.runtime.supportEvents = [event, ...next.runtime.supportEvents].slice(0, 8);
        next.runtime.pulseTrigger += 1;
        eventType = "support.received";
        eventPayload = event;
        break;
      }
      case "runtime.safe-mode": {
        const enabled = booleanPayload(command, "enabled");
        next.runtime.safeMode = enabled;
        eventType = enabled ? "runtime.safe-mode-entered" : "runtime.safe-mode-exited";
        break;
      }
    }
  } catch (error) {
    const outcome = rejected(command.commandId, current.show.revision, {
      code: "COMMAND_INVALID",
      path: "payload",
      severity: "error",
      message: error instanceof Error ? error.message : "Command failed",
    });
    outcome.state = current;
    return outcome;
  }

  const occurredAt = new Date().toISOString();
  const nextRevision =
    command.mode === "execute" ? current.show.revision + 1 : current.show.revision;
  next.show.revision = nextRevision;
  next.show.modifiedAt = occurredAt;

  const event: DomainEvent = {
    schema: "pulsecast.event/v1",
    eventId: `event_${command.commandId}`,
    showId: current.show.id,
    stream: `show/${current.show.id}`,
    sequence: nextRevision,
    type: eventType,
    version: 1,
    occurredAt,
    recordedAt: occurredAt,
    correlationId: command.correlationId,
    causationId: command.commandId,
    producer: "pulsecast-core",
    payload: eventPayload,
  };

  return {
    state: next,
    event,
    result: {
      schema: "pulsecast.command-result/v1",
      commandId: command.commandId,
      status: "accepted",
      revision: nextRevision,
      events: [event.eventId],
      violations: [],
      snapshot: next,
    },
  };
}
