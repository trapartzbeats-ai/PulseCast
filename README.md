# PulseCast Studio

PulseCast Studio is a Windows-first live production application being rebuilt
around one product guarantee: the exact Program picture and mix must be what
gets recorded and routed to Twitch, Facebook, or both.

## Current repository state

This repository contains a retained Foundation control plane and bounded media
proof adapters. It is not yet a production broadcaster.

Current real capabilities include:

- revisioned Show commands and conflict handling;
- autosave projection, JSONL journal, checkpoints, and recovery;
- checksummed `.pcast` export;
- canonical Pulse Core 1.9 renderer integration;
- a supervised C++20 `PulseCastMediaHost.exe` with a versioned JSONL contract;
- real Win32 discovery of official PS Remote Play top-level windows;
- Windows Graphics Capture/D3D11 frame acquisition with start, status, stop,
  resolution, stall, and frame-count telemetry;
- keyed D3D11 shared-texture publication, second-device reopen, and native
  presentation inside the Settings and Production source monitors;
- a native 1920 × 1080 one-source Program-video compositor with a validated
  position/size transform and real composed-frame telemetry;
- browser/Electron device preview;
- bounded camera/microphone and display-to-MP4 proof adapters;
- packaged Windows application shell.

Multi-source scene composition, real Program audio routing, vault-backed
credentials, Twitch/Facebook destination routing, and isolated broadcast
continuity are currently `unavailable`. The older direct camera/microphone
RTMPS worker is disabled at the Electron boundary because it bypasses Program
and does not meet the security contract.

Window capture, one-source D3D11 composition, and native shared-texture
presentation currently have `fault-injected-real` proof against a labeled mock
Remote Play window. This is the first Program-video test path, not a complete
Program: camera layering, graphics ownership, Preview/Program separation,
transitions, recording, and audio are still open. The official Sony client and
PS5 source remain `unavailable` until that exact path passes a named proof run.

Read these before implementation:

- [Master blueprint](PULSECAST_MASTER_BLUEPRINT.md)
- [Full product audit](docs/PRODUCT_AUDIT_2026-08-03.md)
- [Current capability ledger](docs/CAPABILITY_LEDGER.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security boundary](docs/SECURITY.md)

## Install and run

```powershell
cd D:\Projects\PulseCast
npm.cmd install --install-links
npm.cmd run dev
```

Pulse Core 1.9 is consumed from the pinned public package artifact at
`vendor/pulse-engine/pulse-engine-1.9.0.tgz`; a sibling checkout is not
required.

## Verify

```powershell
npm.cmd run verify
```

`verify` requires lint, formatting, TypeScript, all tests, renderer/main
production builds, the native Media Host build and CTest contract suite, a
one-shot native probe, a supervised JSONL probe, and adjacent-adapter inventory
to pass.

## Package and smoke

```powershell
npm.cmd run package:win
npm.cmd run smoke:packaged
```

Artifacts are written beneath an immutable `release-reboot/build-*` directory.
`release-reboot/latest.json` identifies the current build. Packaged smoke launches the unpacked
application with isolated test data, verifies its real window and persistence
files, closes it, and confirms clean lock removal. The current package also
contains `resources/media-host/PulseCastMediaHost.exe` and launches it as a
supervised child of the Electron main process.

The FFmpeg and ffprobe binaries in `vendor/media/` are tracked with Git LFS.
They are GPL v3 builds and remain proof/transitional tooling, not the final
native Program data plane.

## Proof language

All capability reports use exactly one of:

- `real`
- `fault-injected-real`
- `simulated`
- `mock`
- `unavailable`

Renderer, Electron, native, packaged, non-production destination, and
controlled production proof are reported separately.
