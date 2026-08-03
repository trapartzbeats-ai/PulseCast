import { describe, expect, it } from "vitest";
import {
  destinationUrl,
  clampInteger,
  chooseEncoder,
  verifySelectedDevices,
} from "../src/core/ffmpeg-media";
import type { EncoderProbe, MediaDevice } from "../src/core/ffmpeg-media";

/* ── Destination URL validation ── */

describe("destinationUrl", () => {
  it("accepts a valid Twitch stream key with default ingest", () => {
    const url = destinationUrl({
      id: "twitch-test",
      platform: "twitch",
      streamKey: "live_abcdefghijklmnop",
    });
    expect(url).toMatch(/^rtmps:\/\/live\.twitch\.tv:443\/app\/live_/);
    expect(url).not.toContain("bandwidthtest");
  });

  it("appends bandwidthtest when enabled", () => {
    const url = destinationUrl({
      id: "twitch-test",
      platform: "twitch",
      streamKey: "live_abcdefghijklmnop",
      bandwidthTest: true,
    });
    expect(url).toContain("bandwidthtest=true");
  });

  it("rejects an empty stream key", () => {
    expect(() => destinationUrl({ id: "x", platform: "twitch", streamKey: "" })).toThrow(
      "stream key",
    );
  });

  it("rejects a short stream key (fewer than 8 chars)", () => {
    expect(() => destinationUrl({ id: "x", platform: "twitch", streamKey: "short" })).toThrow(
      "stream key",
    );
  });

  it("rejects a stream key with line breaks", () => {
    expect(() =>
      destinationUrl({ id: "x", platform: "twitch", streamKey: "live_key\ninjection" }),
    ).toThrow("stream key");
  });

  it("rejects a non-RTMPS ingest URL", () => {
    expect(() =>
      destinationUrl({
        id: "x",
        platform: "twitch",
        streamKey: "live_abcdefghijklmnop",
        ingestBaseUrl: "http://example.com/ingest",
      }),
    ).toThrow("ingest URL");
  });

  it("rejects an ingest URL with embedded credentials", () => {
    expect(() =>
      destinationUrl({
        id: "x",
        platform: "twitch",
        streamKey: "live_abcdefghijklmnop",
        ingestBaseUrl: "rtmps://user:pass@live.twitch.tv:443/app",
      }),
    ).toThrow("ingest URL");
  });

  it("rejects an ingest URL with query string", () => {
    expect(() =>
      destinationUrl({
        id: "x",
        platform: "twitch",
        streamKey: "live_abcdefghijklmnop",
        ingestBaseUrl: "rtmps://live.twitch.tv:443/app?extra=1",
      }),
    ).toThrow("ingest URL");
  });

  it("rejects a Facebook key with linebreak characters", () => {
    expect(() =>
      destinationUrl({
        id: "x",
        platform: "facebook",
        streamKey: "FB_valid_key_that_is_long_enough\n",
      }),
    ).toThrow("stream key");
  });
});

/* ── clampInteger ── */

describe("clampInteger", () => {
  it("returns the fallback for undefined", () => {
    expect(clampInteger(undefined, 5000, 100, 30000)).toBe(5000);
  });

  it("clamps below minimum", () => {
    expect(clampInteger(1, 5000, 100, 30000)).toBe(100);
  });

  it("clamps above maximum", () => {
    expect(clampInteger(99999, 5000, 100, 30000)).toBe(30000);
  });

  it("returns the value when in range", () => {
    expect(clampInteger(1500, 5000, 100, 30000)).toBe(1500);
  });
});

/* ── chooseEncoder ── */

describe("chooseEncoder", () => {
  const encoders: EncoderProbe[] = [
    { name: "h264_nvenc", available: true, hardware: true },
    { name: "h264_qsv", available: false, hardware: true },
    { name: "h264_amf", available: false, hardware: true },
    { name: "libx264", available: true, hardware: false },
  ];

  it("returns the first available hardware encoder with auto", () => {
    expect(chooseEncoder("auto", encoders)).toBe("h264_nvenc");
  });

  it("falls back to libx264 when no hardware encoder is available", () => {
    const noHw: EncoderProbe[] = [
      { name: "h264_nvenc", available: false, hardware: true },
      { name: "h264_qsv", available: false, hardware: true },
      { name: "h264_amf", available: false, hardware: true },
      { name: "libx264", available: true, hardware: false },
    ];
    expect(chooseEncoder("auto", noHw)).toBe("libx264");
  });

  it("returns a specific requested encoder when available", () => {
    expect(chooseEncoder("h264_nvenc", encoders)).toBe("h264_nvenc");
  });

  it("throws when a specific encoder is unavailable", () => {
    expect(() => chooseEncoder("h264_amf", encoders)).toThrow("unavailable");
  });
});

/* ── verifySelectedDevices ── */

describe("verifySelectedDevices", () => {
  const devices: MediaDevice[] = [
    { kind: "video", name: "Integrated Camera", alternativeName: null },
    { kind: "audio", name: "Microphone (Realtek)", alternativeName: null },
  ];

  it("passes when both devices exist", () => {
    expect(() =>
      verifySelectedDevices(devices, {
        videoDevice: "Integrated Camera",
        audioDevice: "Microphone (Realtek)",
      }),
    ).not.toThrow();
  });

  it("throws when the video device is missing", () => {
    expect(() =>
      verifySelectedDevices(devices, {
        videoDevice: "Nonexistent Camera",
        audioDevice: "Microphone (Realtek)",
      }),
    ).toThrow("camera or microphone is not present");
  });

  it("throws when the audio device is missing", () => {
    expect(() =>
      verifySelectedDevices(devices, {
        videoDevice: "Integrated Camera",
        audioDevice: "Missing Mic",
      }),
    ).toThrow("camera or microphone is not present");
  });

  it("throws when both devices are missing", () => {
    expect(() =>
      verifySelectedDevices(devices, {
        videoDevice: "A",
        audioDevice: "B",
      }),
    ).toThrow("camera or microphone is not present");
  });
});
