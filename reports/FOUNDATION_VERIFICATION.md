# PulseCast Foundation verification

Verified on Windows on 2026-07-28.

## Product boundary

This evidence covers the runnable Foundation control plane. It does not claim
the full PulseCast 0.1 media or broadcast path.

## Automated checks

| Gate | Result |
|---|---|
| TypeScript typecheck | PASS |
| Vitest | PASS, 6 of 6 |
| Vite production build | PASS |
| Electron main/preload build | PASS |
| Adjacent adapter fingerprint probe | PASS, 4 of 4 present |
| C++20 proof-contract build | PASS |
| CTest | PASS, 1 of 1 |

The renderer build reports a non-blocking large-chunk warning for the canonical
Pulse runtime bundle.

## Portable Show proof

The compiled runtime exported
`reports/runtime/export-smoke/exports/PulseCast-Foundation-Demo.pcast` with
SHA-256
`5b9fbc53b485711fa38ee7e8742d32c42dedf446be3923eeccde84651a33884e`.
The archive contains `manifest.json`, `show.json`, `rundown.json`,
`recovery/summary.json`, and `checksums.json`; no destination credentials are
included.

## Real native media proof

`ScreenRecorderProcessAdapter/v1` completed a bounded real display-recording
proof:

| Field | Evidence |
|---|---|
| Result | PASS |
| Output | `reports/runtime/native-final/display-proof-1785263011439-34164.mp4` |
| Bytes | 117303 |
| SHA-256 | `0f04e659b110d84cb34c5d15f7f69e095cbd984937ef3a4e77ec09802705669e` |
| Codec | H.264 |
| Frame | 640 x 360 |
| Rate | 30 fps |
| Duration | 1.2333 seconds |
| Encoder selection | unverified |

This proves a display-to-MP4 process adapter. It does not prove camera
composition, audio, shared D3D11 textures, hardware encoding, or live output.

## Desktop runtime smoke

The production Electron build opened a real `PulseCast Studio — Foundation`
window with renderer, GPU, and utility child processes. It created the working
Show, checkpoint, and last-known-good files. A normal window close exited
within ten seconds and removed the recovery session lock.

## UI proof

The evidence package at
`reports/ui-proof/20260728-130500-foundation-studio/` is `CERTIFIED` for the
Foundation surface:

- 1440 x 900 fits without document overflow;
- 1024 x 720 has no horizontal overflow;
- default, failure, diagnostics, and recovery states are captured;
- a clean Chrome session reported zero errors and zero warnings;
- reduced motion produced no named animations.

## Open Phase 0 gates

- real camera plus display GPU composition;
- WASAPI microphone and desktop routing;
- verified hardware encoder selection;
- RTMPS transport, reconnect, and credential-vault integration;
- isolated media-worker continuity.
