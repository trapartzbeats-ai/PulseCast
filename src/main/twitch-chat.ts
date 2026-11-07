import type { ChatEvent } from "../shared/contracts";

/**
 * Reads a Twitch channel's chat with the anonymous "justinfan" login: no password,
 * no token, read-only. Subs, gifts and raids arrive in the same stream as USERNOTICE
 * lines, so they can drive on-screen alerts. Follows are not in chat, so they are not here.
 */
export class TwitchChat {
  private socket: WebSocket | null = null;
  private channel = "";
  private wanted = false;
  private retry: NodeJS.Timeout | null = null;
  private attempts = 0;

  constructor(private emit: (event: ChatEvent) => void) {}

  connect(rawChannel: string): void {
    const channel = rawChannel.trim().replace(/^#/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(channel)) {
      throw new Error("That does not look like a Twitch channel name.");
    }
    this.disconnect();
    this.channel = channel;
    this.wanted = true;
    this.attempts = 0;
    this.open();
  }

  disconnect(): void {
    this.wanted = false;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        // already closed
      }
      this.emit({ type: "status", source: "twitch", state: "off", detail: "" });
    }
  }

  private open(): void {
    this.emit({ type: "status", source: "twitch", state: "connecting", detail: this.channel });
    const socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    this.socket = socket;
    socket.addEventListener("open", () => {
      socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      socket.send("PASS SCHMOOZE");
      socket.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      socket.send(`JOIN #${this.channel}`);
    });
    socket.addEventListener("message", (event) => {
      for (const line of String(event.data).split("\r\n")) if (line) this.line(socket, line);
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (!this.wanted) return;
      this.attempts += 1;
      this.emit({
        type: "status",
        source: "twitch",
        state: "connecting",
        detail: `reconnecting (${this.attempts})`,
      });
      this.retry = setTimeout(() => this.open(), Math.min(30_000, 1500 * this.attempts));
    });
    socket.addEventListener("error", () => {
      this.emit({
        type: "status",
        source: "twitch",
        state: "error",
        detail: "chat connection problem",
      });
    });
  }

  private line(socket: WebSocket, raw: string): void {
    let rest = raw;
    const tags: Record<string, string> = {};
    if (rest.startsWith("@")) {
      const space = rest.indexOf(" ");
      for (const pair of rest.slice(1, space).split(";")) {
        const eq = pair.indexOf("=");
        tags[pair.slice(0, eq)] = unescapeTag(pair.slice(eq + 1));
      }
      rest = rest.slice(space + 1);
    }
    if (rest.startsWith("PING")) {
      socket.send(rest.replace("PING", "PONG"));
      return;
    }
    const parts = rest.split(" ");
    const command = parts[1];
    const trailing = rest.includes(" :") ? rest.slice(rest.indexOf(" :", 1) + 2) : "";
    if (command === "366") {
      this.attempts = 0;
      this.emit({ type: "status", source: "twitch", state: "on", detail: this.channel });
    } else if (command === "PRIVMSG") {
      this.emit({
        type: "message",
        id: tags.id || `${Date.now()}${Math.random()}`,
        user: tags["display-name"] || parts[0].slice(1).split("!")[0],
        color: tags.color || "",
        text: trailing,
      });
    } else if (command === "USERNOTICE") {
      const who = tags["display-name"] || tags.login || "Someone";
      const id = tags["msg-id"];
      if (id === "sub" || id === "resub") {
        const months = Number(tags["msg-param-cumulative-months"] || 1);
        this.emit({
          type: "alert",
          id: tags.id || String(Date.now()),
          title: `${who} subscribed`,
          detail: months > 1 ? `${months} months` : trailing,
        });
      } else if (id === "subgift" || id === "anonsubgift") {
        this.emit({
          type: "alert",
          id: tags.id || String(Date.now()),
          title: `${who} gifted a sub`,
          detail: `to ${tags["msg-param-recipient-display-name"] || "a viewer"}`,
        });
      } else if (id === "raid") {
        this.emit({
          type: "alert",
          id: tags.id || String(Date.now()),
          title: `${tags["msg-param-displayName"] || who} is raiding`,
          detail: `${tags["msg-param-viewerCount"] || "?"} viewers`,
        });
      }
    } else if (command === "NOTICE" && /Login unsuccessful|Improperly formatted/.test(trailing)) {
      this.emit({ type: "status", source: "twitch", state: "error", detail: trailing });
    }
  }
}

function unescapeTag(value: string): string {
  return value.replace(/\\(.)/g, (_, c: string) =>
    c === "s" ? " " : c === ":" ? ";" : c === "n" ? "\n" : c === "r" ? "\r" : c,
  );
}
