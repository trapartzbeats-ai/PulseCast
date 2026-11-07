import { afterEach, describe, expect, it, vi } from "vitest";
import { TwitchChat } from "../src/main/twitch-chat";
import type { ChatEvent } from "../src/shared/contracts";

class FakeSocket {
  static last: FakeSocket;
  sent: string[] = [];
  private handlers: Record<string, Array<(e: unknown) => void>> = {};
  constructor() {
    FakeSocket.last = this;
  }
  addEventListener(name: string, fn: (e: unknown) => void): void {
    (this.handlers[name] ??= []).push(fn);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {}
  fire(name: string, event: unknown = {}): void {
    for (const fn of this.handlers[name] ?? []) fn(event);
  }
}

function setup() {
  vi.stubGlobal("WebSocket", FakeSocket);
  const events: ChatEvent[] = [];
  const chat = new TwitchChat((e) => events.push(e));
  chat.connect("#SomeChannel");
  const socket = FakeSocket.last;
  socket.fire("open");
  return { chat, socket, events };
}

afterEach(() => vi.unstubAllGlobals());

describe("Twitch anonymous chat reader", () => {
  it("joins read-only with an anonymous login and no token", () => {
    const { socket } = setup();
    expect(socket.sent[0]).toContain("CAP REQ");
    expect(socket.sent[1]).toBe("PASS SCHMOOZE");
    expect(socket.sent[2]).toMatch(/^NICK justinfan\d+$/);
    expect(socket.sent[3]).toBe("JOIN #somechannel");
  });

  it("rejects names that are not Twitch channels", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    expect(() => new TwitchChat(() => undefined).connect("not a name!")).toThrow(/channel name/);
  });

  it("turns chat lines into messages with the viewer's colour", () => {
    const { socket, events } = setup();
    socket.fire("message", {
      data: "@color=#FF4500;display-name=Vix;id=abc :vix!vix@vix.tmi.twitch.tv PRIVMSG #somechannel :hello there: world\r\n",
    });
    expect(events).toContainEqual({
      type: "message",
      id: "abc",
      user: "Vix",
      color: "#FF4500",
      text: "hello there: world",
    });
  });

  it("raises alerts for subs, gifts and raids", () => {
    const { socket, events } = setup();
    socket.fire("message", {
      data:
        "@display-name=Carter;id=1;msg-id=resub;msg-param-cumulative-months=4 :tmi.twitch.tv USERNOTICE #somechannel :thanks\r\n" +
        "@display-name=Slum;id=2;msg-id=subgift;msg-param-recipient-display-name=Al :tmi.twitch.tv USERNOTICE #somechannel\r\n" +
        "@display-name=Boss;id=3;msg-id=raid;msg-param-displayName=Boss;msg-param-viewerCount=57 :tmi.twitch.tv USERNOTICE #somechannel\r\n",
    });
    const alerts = events.filter((e) => e.type === "alert");
    expect(alerts).toEqual([
      { type: "alert", id: "1", title: "Carter subscribed", detail: "4 months" },
      { type: "alert", id: "2", title: "Slum gifted a sub", detail: "to Al" },
      { type: "alert", id: "3", title: "Boss is raiding", detail: "57 viewers" },
    ]);
  });

  it("answers PING and reports when the room is joined", () => {
    const { socket, events } = setup();
    socket.fire("message", { data: "PING :tmi.twitch.tv\r\n" });
    expect(socket.sent).toContain("PONG :tmi.twitch.tv");
    socket.fire("message", {
      data: ":nick.tmi.twitch.tv 366 nick #somechannel :End of /NAMES list\r\n",
    });
    expect(events).toContainEqual({
      type: "status",
      source: "twitch",
      state: "on",
      detail: "somechannel",
    });
  });
});
