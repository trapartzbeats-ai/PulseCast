import { describe, expect, it } from "vitest";
import { FacebookChat } from "../src/main/facebook-chat";
import type { ChatEvent } from "../src/shared/contracts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function sse(...frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const f of frames) controller.enqueue(encoder.encode(f));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

const waitFor = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

describe("Facebook Page live comments reader", () => {
  it("finds the live video, then turns streamed comments into chat lines", async () => {
    const urls: string[] = [];
    const events: ChatEvent[] = [];
    let streams = 0;
    const fakeFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/me/live_videos")) {
        return json({
          data: [
            { id: "111", status: "VOD" },
            { id: "222", status: "LIVE" },
          ],
        });
      }
      streams += 1;
      return streams === 1
        ? sse(
            'data: {"id":"c1","message":"hi from fb","from":{"name":"Dana"}}\n\n',
            'data: {"id":"c2","mess',
            'age":"split frame","from":{"name":"Eli"}}\n\n',
          )
        : new Promise<Response>(() => undefined); // later reconnects just hang
    }) as typeof fetch;
    const chat = new FacebookChat((e) => events.push(e), fakeFetch, 5);
    chat.connect("PAGE_TOKEN");
    await waitFor(() => events.filter((e) => e.type === "message").length === 2);
    chat.disconnect();
    const messages = events.filter((e) => e.type === "message");
    expect(messages.map((m) => (m.type === "message" ? `${m.user}: ${m.text}` : ""))).toEqual([
      "Dana: hi from fb",
      "Eli: split frame",
    ]);
    expect(urls.some((u) => u.includes("streaming-graph.facebook.com/222/live_comments"))).toBe(
      true,
    );
    expect(events).toContainEqual({
      type: "status",
      source: "facebook",
      state: "on",
      detail: "reading live comments",
    });
  });

  it("waits quietly when the Page is not live yet", async () => {
    const events: ChatEvent[] = [];
    const fakeFetch = (async () => json({ data: [] })) as unknown as typeof fetch;
    const chat = new FacebookChat((e) => events.push(e), fakeFetch, 5);
    chat.connect("PAGE_TOKEN");
    await waitFor(() => events.some((e) => e.type === "status" && /waiting/.test(e.detail)));
    chat.disconnect();
    expect(events.some((e) => e.type === "message")).toBe(false);
  });

  it("stops and explains when the token is expired", async () => {
    const events: ChatEvent[] = [];
    const fakeFetch = (async () =>
      json(
        { error: { code: 190, message: "Error validating access token" } },
        400,
      )) as unknown as typeof fetch;
    const chat = new FacebookChat((e) => events.push(e), fakeFetch, 5);
    chat.connect("OLD");
    await waitFor(() => events.some((e) => e.type === "status" && e.state === "error"));
    const error = events.find((e) => e.type === "status" && e.state === "error");
    expect(error && error.type === "status" && error.detail).toMatch(/invalid or expired/);
    expect(chat.running).toBe(false);
  });

  it("refuses an empty token", () => {
    expect(() => new FacebookChat(() => undefined).connect("  ")).toThrow(/token/);
  });
});
