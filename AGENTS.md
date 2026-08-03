# PulseCast Studio Agent Guide

## Authority

- `PULSECAST_MASTER_BLUEPRINT.md` is the product and architecture contract.
- `docs/FOUNDATION_ACCEPTANCE.md` defines what the current repository proves.
- Adjacent projects are upstream systems. Integrate only through public,
  versioned adapters; do not copy their internal applications into PulseCast.

## Proof language

Every capability report must use one of:

- `real`
- `fault-injected-real`
- `simulated`
- `mock`
- `unavailable`

Never let a mock platform, synthetic meter, placeholder source, retained binary,
browser screenshot, or offline renderer satisfy a live media acceptance gate.
Report local renderer proof, Electron proof, native proof, packaged proof, and
live-stream proof separately.

## Safe workflow

1. Inspect `git status --short` and preserve unrelated work.
2. Change authoritative source, schemas, tests, and docs together.
3. Run `npm.cmd run verify` for the TypeScript/Electron control surface.
4. Run `npm.cmd run native:verify` for native contract changes.
5. Capture UI evidence under `reports/ui-proof/` before promotion.
6. Keep credentials, stream keys, OAuth tokens, cookies, and private chat out
   of Show files, journals, tests, logs, and diagnostic exports.

## Current boundaries

- The Electron surface is a Foundation control-plane prototype.
- The ScreenRecorder CLI is a real display-recording proof adapter, not the
  future live shared-texture capture path.
- Camera, live audio, Twitch, and Facebook behavior are currently simulated or
  mocked and must remain visibly labeled.
- The future broadcast data plane is C++20/D3D11/WASAPI and isolated processes.



## Phase 3 completed (2026-07-28)

- Security gate in FfmpegMediaEngine blocks production endpoints without bandwidth test or override
- Real Media Test route merged into the production Studio (DevicesPanel + useMediaDevices hook)
- RealMediaWorkspace.tsx deleted
- Media engine tests: 8 to 29 tests (21 new covering destinationUrl, clampInteger, chooseEncoder, verifySelectedDevices)
- Packaging consolidated to single release/ folder
- afterPack locale-pruning hook added
- ESLint + Prettier configured (0 errors, 0 warnings)



## Phase 5 — C++ native data plane deferred (2026-07-28)

- Deleted native/ directory and CMakeLists.txt (4 KB of struct definitions only, no runtime consumer)
- Removed native:* scripts from package.json
- The D3D11 shared-texture and WASAPI capture paths remain Phase 0 gates for a future C++ data plane

