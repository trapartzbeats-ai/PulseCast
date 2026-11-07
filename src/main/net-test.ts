import { randomBytes } from "node:crypto";
import { net } from "electron";

export interface UploadTestResult {
  /** Measured upload speed in kilobits per second. */
  kbps: number;
  seconds: number;
}

/**
 * Measures this PC's real upload speed by sending throwaway random bytes to Cloudflare's public speed-test
 * endpoint over three connections for a few seconds. Only runs when the user presses the test button.
 */
export async function uploadTest(seconds = 6): Promise<UploadTestResult> {
  const chunk = randomBytes(1_000_000);
  const started = Date.now();
  const deadline = started + seconds * 1000;
  const abort = new AbortController();
  const hardStop = setTimeout(() => abort.abort(), (seconds + 8) * 1000);
  let bytes = 0;
  let firstError: unknown = null;
  const worker = async () => {
    while (Date.now() < deadline) {
      try {
        const res = await net.fetch("https://speed.cloudflare.com/__up", {
          method: "POST",
          body: chunk,
          signal: abort.signal,
        });
        await res.arrayBuffer();
        if (!res.ok) throw new Error(`speed test server answered ${res.status}`);
        bytes += chunk.length;
      } catch (error) {
        firstError ??= error;
        return;
      }
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()]);
  } finally {
    clearTimeout(hardStop);
  }
  const elapsed = (Date.now() - started) / 1000;
  if (bytes === 0) {
    const reason = firstError instanceof Error ? firstError.message : "no answer";
    throw new Error(`Could not measure upload speed (${reason}). Check the internet connection.`);
  }
  return { kbps: Math.round((bytes * 8) / 1000 / elapsed), seconds: Math.round(elapsed * 10) / 10 };
}
