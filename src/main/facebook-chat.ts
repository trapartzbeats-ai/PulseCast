import type { ChatEvent } from "../shared/contracts";

const GRAPH = "https://graph.facebook.com/v21.0";
const STREAMING = "https://streaming-graph.facebook.com";

type Emit = (event: ChatEvent) => void;

interface GraphError {
  error?: { message?: string; code?: number };
}

/**
 * Reads the live comments of the Facebook Page that owns the token, over the Graph API's
 * server-sent-events stream. Facebook only offers this for Pages (not personal profiles).
 * It waits for the Page's live video to start, then follows it and reconnects if the
 * stream drops. The token is only ever sent to facebook.com hosts and is never logged.
 */
export class FacebookChat {
  private run = 0;
  private abort: AbortController | null = null;

  constructor(
    private emit: Emit,
    private doFetch: typeof fetch = fetch,
    private pauseMs = 8000,
  ) {}

  get running(): boolean {
    return this.run > 0;
  }

  connect(token: string): void {
    this.disconnect();
    const clean = token.trim();
    if (!clean) throw new Error("Save a Facebook Page access token first.");
    const mine = ++this.run;
    this.abort = new AbortController();
    void this.loop(clean, mine, this.abort.signal);
  }

  disconnect(): void {
    const was = this.run > 0;
    this.run = 0;
    this.abort?.abort();
    this.abort = null;
    if (was) this.emit({ type: "status", source: "facebook", state: "off", detail: "" });
  }

  private alive(mine: number): boolean {
    return this.run === mine;
  }

  private status(state: "connecting" | "on" | "error", detail: string): void {
    this.emit({ type: "status", source: "facebook", state, detail });
  }

  private async loop(token: string, mine: number, signal: AbortSignal): Promise<void> {
    let announcedWaiting = false;
    while (this.alive(mine)) {
      try {
        const video = await this.findLiveVideo(token, signal);
        if (!this.alive(mine)) return;
        if (!video) {
          if (!announcedWaiting) this.status("connecting", "waiting for your Page to go live");
          announcedWaiting = true;
        } else {
          announcedWaiting = false;
          this.status("on", "reading live comments");
          await this.follow(token, video, mine, signal);
          if (!this.alive(mine)) return;
          this.status("connecting", "reconnecting");
        }
      } catch (error) {
        if (!this.alive(mine) || signal.aborted) return;
        const fatal = error instanceof FatalChatError;
        this.status("error", error instanceof Error ? error.message : "Facebook chat problem");
        if (fatal) {
          this.run = 0;
          return;
        }
      }
      await sleep(this.pauseMs, signal);
    }
  }

  private async findLiveVideo(token: string, signal: AbortSignal): Promise<string | null> {
    const url = `${GRAPH}/me/live_videos?fields=id,status&limit=5&access_token=${encodeURIComponent(token)}`;
    const response = await this.doFetch(url, { signal });
    const body = (await response.json()) as GraphError & {
      data?: Array<{ id: string; status: string }>;
    };
    if (body.error) throw graphProblem(body);
    const live = body.data?.find((v) => v.status === "LIVE" || v.status === "LIVE_NOW");
    return live?.id ?? null;
  }

  private async follow(
    token: string,
    videoId: string,
    mine: number,
    signal: AbortSignal,
  ): Promise<void> {
    const url =
      `${STREAMING}/${encodeURIComponent(videoId)}/live_comments?comment_rate=one_per_two_seconds` +
      `&fields=from{name},message,id&access_token=${encodeURIComponent(token)}`;
    const response = await this.doFetch(url, { signal, headers: { Accept: "text/event-stream" } });
    if (!response.ok || !response.body) {
      let body: GraphError = {};
      try {
        body = (await response.json()) as GraphError;
      } catch {
        // not JSON
      }
      throw body.error ? graphProblem(body) : new Error(`Facebook answered ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (this.alive(mine)) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let cut: number;
      while ((cut = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        this.block(block);
      }
    }
  }

  private block(block: string): void {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5).trim()) as {
          id?: string;
          message?: string;
          from?: { name?: string };
        };
        if (data.message) {
          this.emit({
            type: "message",
            id: data.id ?? `${Date.now()}${Math.random()}`,
            user: data.from?.name ?? "Viewer",
            color: "#7fb2ff",
            text: data.message,
          });
        }
      } catch {
        // keep-alive or partial line
      }
    }
  }
}

class FatalChatError extends Error {}

function graphProblem(body: GraphError): Error {
  const code = body.error?.code;
  const message = body.error?.message ?? "Facebook refused the request";
  // 190 = token invalid or expired, 10/200/283 = permission missing: retrying will not help
  if (code === 190 || code === 10 || code === 200 || code === 283) {
    return new FatalChatError(
      code === 190
        ? "Facebook says this token is invalid or expired. Make a new Page token and save it."
        : `Facebook needs another permission on this token: ${message}`,
    );
  }
  return new Error(message);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
