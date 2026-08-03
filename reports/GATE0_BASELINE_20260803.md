# PulseCast Gate 0 Baseline

Date: 2026-08-03  
Version: 0.3.0-reboot  
Status: PASS

## Scope

This report proves repository truth, current source quality, Windows packaging,
and the retained UI boundary. It does not prove the Gate 1 Program compositor,
Gate 2 audio graph, Gate 4 Twitch/Facebook routing, or native PlayStation
source.

## Source gates

| Gate | Result |
|---|---|
| ESLint | PASS, 0 errors and 0 warnings |
| Prettier | PASS |
| TypeScript renderer/core | PASS |
| TypeScript Electron main/preload | PASS |
| Vitest | PASS, 29 of 29 |
| Vite production build | PASS |
| Electron main build | PASS |
| Adapter inventory | PASS |

The renderer bundle remains approximately 977 KB minified and produces a
non-blocking chunk-size warning. Code splitting is scheduled with the workspace
rebuild rather than treated as a Gate 0 blocker.

## Repository gates

- Git repository initialized on `main`.
- Git LFS configured for FFmpeg and ffprobe binaries.
- Pulse Core 1.9 pinned as a public npm package tarball.
- A clean clone no longer requires the sibling `pulse-core` checkout.
- CI verifies Windows source gates and creates an unpacked artifact.
- Product identity is `PulseCast Studio` / `0.3.0-reboot`.
- Generated build, release, runtime, browser, and local output folders are
  ignored.

## Security boundary

- Renderer stream-key forms removed.
- Direct camera/microphone RTMPS start IPC disabled.
- UI states that Program routing and the credential vault are unavailable.
- Twitch/Facebook routing remains a Gate 4 capability.
- PlayStation registration keys and tokens are specified as vault secrets.

## UI evidence

The current evidence package is
`reports/ui-proof/20260803-112400-gate0-baseline/` with status `WARN`.

The Vite renderer opened at 1440 x 900 with no console errors or warnings. The
former nested interactive control error is repaired. The retained Foundation
workspace is accepted only as a truthful Gate 0 baseline and is not promoted
as Release 1.0 UX.

## Packaged artifacts

Full package directory: `release-reboot/build-20260803-113900/`

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `PulseCast-Studio-Setup-0.3.0-reboot-x64.exe` | 132,828,043 | `F6DCB6C16FA668A7B4B0FFFB5C6FC51DD82D8C4D65188EF60B4CD8DEC3D33E8A` |
| `PulseCast-Studio-Portable-0.3.0-reboot-x64.exe` | 132,597,978 | `D20CBAAFF227B69A0E2329F19FA33C2056F16944FA6C55EC7346521DDC32BC35` |
| `win-unpacked/PulseCast Studio.exe` | 210,832,384 | `2EF62899757DC6423D319678623ACF566362152A7B1ADDE9E34C0E9609FD7CFC` |

The files are not asserted to be publisher-signed. Electron Builder's signing
steps do not prove trusted publisher identity without a configured certificate.

## Packaged smoke

The immutable packaging helper produced
`release-reboot/build-20260803-113945/win-unpacked/` from a temp staging area.
Smoke result:

- real `PulseCast Studio` window opened: PASS;
- working Show state created: PASS;
- checkpoint created: PASS;
- close request accepted: PASS;
- process exited within ten seconds: PASS;
- session lock removed: PASS.

This is packaged shell/persistence proof only.

## Product direction added during Gate 0

Release 1.0 now includes:

- official PS Remote Play window capture;
- WASAPI process audio for that window;
- local camera/microphone/graphics composition;
- Program routing to Twitch, Facebook, or both;
- optional owned Twitch playback ingest with latency synchronization.

A deeper native PlayStation source is Gate 6A. Chiaki-ng is AGPL-3.0 and
PyRemotePlay is GPL-3.0, so any derived adapter must remain separately
licensed/source-published and pass legal review before distribution.
