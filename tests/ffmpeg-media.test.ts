import { describe, expect, it } from "vitest";
import { parseDirectShowDevices, redactMediaLog } from "../src/core/ffmpeg-media";

describe("FFmpeg media adapter safety helpers", () => {
  it("parses real DirectShow video and audio inventory output", () => {
    const devices = parseDirectShowDevices(`
[dshow @ 000001] "Integrated Webcam" (video)
[dshow @ 000001]   Alternative name "@device_pnp_camera"
[dshow @ 000001] "Microphone Array (Realtek Audio)" (audio)
[dshow @ 000001]   Alternative name "@device_cm_microphone"
`);

    expect(devices).toEqual([
      {
        kind: "video",
        name: "Integrated Webcam",
        alternativeName: "@device_pnp_camera",
      },
      {
        kind: "audio",
        name: "Microphone Array (Realtek Audio)",
        alternativeName: "@device_cm_microphone",
      },
    ]);
  });

  it("redacts stream keys in raw and RTMPS URL forms", () => {
    const twitchKey = "live_example_secret";
    const facebookKey = "FB-example-secret";
    const redacted = redactMediaLog(
      [
        `Opening rtmps://live.twitch.tv:443/app/${twitchKey}`,
        `Opening rtmps://live-api-s.facebook.com:443/rtmp/${facebookKey}`,
        `key=${twitchKey}&token=${facebookKey}`,
        `raw ${twitchKey}`,
      ].join("\n"),
      [twitchKey, facebookKey],
    );

    expect(redacted).not.toContain(twitchKey);
    expect(redacted).not.toContain(facebookKey);
    expect(redacted.match(/\[REDACTED]/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
