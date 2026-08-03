# PulseCast Studio Full Product Audit

Date: 2026-08-03  
Scope: repository, current source, current browser runtime, tests, packaging
scripts, product docs, proof reports, and release artifacts  
Conclusion: architectural reboot required; blank-slate rewrite not required

## Executive verdict

The current application is a credible Foundation and media-test harness, but
it is not a coherent broadcasting product. The user is correct that it behaves
like an MVP.

The primary problem is not visual polish or the number of missing features.
PulseCast currently contains two disconnected paths:

1. a Show/control-plane workspace with scenes, transforms, Pulse graphics,
   simulated routing, mock destination state, journal, checkpoint, and export;
2. a real FFmpeg DirectShow path that records or sends a selected camera and
   microphone directly.

The real output path does not consume the Program canvas or Program audio
model. Screen share, source transforms, scene choices, Pulse graphics, audio
routes, vertical canvas selection, and mock destination state can all change
without changing the encoded output. Conversely, real FFmpeg health does not
authoritatively drive the Foundation destination tray.

This violates the central expectation of any studio product: what the operator
sees and hears as Program must be what is recorded and broadcast.

Recommendation: retain the useful core and proof adapters, freeze feature
expansion, and rebuild around a single authoritative Program media graph. Use
`PULSECAST_MASTER_BLUEPRINT.md` v2 as the new contract.

## Current proof snapshot

| Area | Status | Audit result |
|---|---|---|
| TypeScript typecheck | real | PASS on 2026-08-03 |
| Vitest | real | PASS, 29 of 29 |
| Renderer/main build | real | PASS |
| Adapter fingerprint probe | real | PASS, 4 adjacent artifacts found |
| Lint | real | FAIL, 1 error and 11 warnings |
| Format check | real | FAIL, 24 files |
| Browser runtime | real renderer | Opens and interactions render |
| Browser console | real renderer | FAIL, invalid nested button error |
| 1440 x 900 layout | real renderer | Usable but dense and proof-oriented |
| Narrow runtime layout | real renderer | Horizontal scrolling and panel loss observed |
| Packaged smoke script | real script | FAIL, expects obsolete executable name |
| Current packaged artifacts | retained binary | Present but not re-certified in this audit |
| Live production stream | unavailable as product proof | No current controlled live proof |

Finding adjacent executables proves only their presence. It does not prove
their integration into the Program media path.

## Product scorecard

| Dimension | Score | Reason |
|---|---:|---|
| Product coherence | 1/5 | Show controls and real output are disconnected |
| Core broadcasting | 1/5 | Real RTMPS code exists, but it bypasses Program |
| Show creation/editing | 1/5 | One hard-coded demo; no Show, scene, or source CRUD |
| Audio workflow | 1/5 | Real preview meter and simulated routing coexist |
| Recording workflow | 1/5 | Ten-second proof, not Program recording product flow |
| Reliability model | 3/5 | Strong journal/checkpoint concepts, not media continuity |
| Security | 1/5 | Stream keys reach FFmpeg child command-line arguments |
| UI/UX | 2/5 | Visually intentional, but organized around proof and labs |
| Maintainability | 1/5 | Monoliths, duplicated media ownership, failing lint/format |
| Test depth | 2/5 | Useful pure tests; almost no end-to-end media/UI coverage |
| Packaging | 1/5 | Artifacts exist; current smoke command is stale and fails |
| Documentation truth | 1/5 | Multiple mutually inconsistent generations of claims |

## What is genuinely reusable

### Real and worth retaining

- Revisioned command envelopes, base-revision conflict handling, immutable
  domain event concepts, and idempotency intent.
- Atomic working-state writes, append-only journal, checkpoints,
  last-known-good restore, and checksummed `.pcast` export concepts.
- Canonical Pulse Core ownership and component cleanup.
- DirectShow device parsing, encoder selection, input validation, stream-key
  redaction, and FFmpeg lifecycle helpers as bounded test assets.
- Electron context isolation, disabled renderer Node integration, and narrow
  preload bridge direction.
- Proof labels and the discipline of separating bounded proof from live proof.
- Windows packaging configuration and existing media binaries, subject to
  license and current packaged verification.

### Real but only as bounded proof

- Browser/Electron camera and microphone preview.
- Browser screen-share preview.
- Camera-plus-microphone FFmpeg recording proof.
- RTMPS worker implementation and reconnect logic.
- ScreenRecorder display-to-MP4 process adapter.
- Pulse renderer visible in the UI.

These do not currently prove the final Program compositor, audio graph,
recording graph, or destination graph.

## Critical findings

### P0 — Output bypasses the studio

`FfmpegMediaEngine` builds its capture input from DirectShow camera and audio
device names. It does not receive the composed canvas, browser screen share,
Pulse graphic pixels, layer transforms, selected scene, or modeled audio bus.

Impact: a user can build one picture in the Studio and send a different raw
camera/microphone feed. This blocks any product release.

Required decision: one native Program frame and Program audio bus must feed
both recorder and destination encoder.

### P0 — Credential implementation violates the documented boundary

The security documentation forbids raw secrets in command-line arguments and
requires Windows Credential Manager before real network output. Current
destination forms accept stream keys in renderer memory and the FFmpeg worker
places full destination URLs in child-process arguments. The contract itself
labels this `runtime-memory-and-child-command-line`.

Impact: secrets can be exposed through process inspection or diagnostic
surfaces; docs and implementation contradict one another.

Required decision: disable production output until vault-backed opaque
credential references reach an isolated worker without command-line secrets.

### P0 — No product creation workflow

The app always opens `PulseCast Flagship Foundation`. The repository path is
hard-coded to `shows/foundation-flagship`; export is hard-coded to
`PulseCast-Foundation-Demo.pcast`. There is no New/Open Show, scene CRUD,
source CRUD, asset management, destination management, import, rename, or
delete workflow.

Impact: users can manipulate a demonstration, but cannot make the product
their own.

### P0 — Preview and Program are not separate

The center surface is labeled Current Preview, while activating or advancing a
cue changes the single active scene. There is no Program state, Take action,
transition execution, or program-safe rehearsal model.

Impact: the core mental model of live production is absent.

### P0 — Current product claims are mutually inconsistent

- The agent guide says the native directory and `native:*` scripts were
  removed; stale `build/native` output remains.
- README and packaging docs still instruct `npm.cmd run native:verify`, which
  no longer exists.
- Foundation acceptance says RTMPS and destination credential entry are
  unavailable, while current source includes a real-media destination form and
  FFmpeg RTMPS worker.
- The package is `0.2.0-real-media-test`, while repository and export strings
  still claim `0.1.0-foundation`.
- The current packaged smoke script looks for `PulseCast Studio Foundation.exe`;
  the release folder contains `PulseCast Studio Real Media Test.exe`.
- Old reports claim six tests and native CTest; current suite has 29 tests and
  the native scripts were removed.

Impact: no single document describes the current product, and old proof can be
mistaken for current certification.

### P1 — Duplicate and dead media UI

`Studio` owns one `useMediaDevices` instance for the Production workspace and
Devices panel. `SettingsView` creates a second independent instance, repeats
destination/device state, defines a start-stream handler and readiness flag,
but does not render the start/stop action. Its `state`, `execute`, and
`onHealthChanged` props are unused.

Impact: switching workspaces can create conflicting state and two versions of
the same controls. In Settings, users can paste keys and confirm intent but
cannot start output.

### P1 — Product surface is a proof control room

The main screen emphasizes Foundation, Real Media Test, test tone, synthetic
health selectors, mock health, support-event lab, simulated interruption,
adapter diagnostics, and unavailable gates. Graphics and Replay are disabled
tabs.

Impact: the UI honestly demonstrates engineering progress, but does not guide
a creator through building, rehearsing, recording, and running a Show.

### P1 — Browser fallback can be mistaken for the product

The Vite renderer supplies an in-memory bridge that accepts Show edits and
simulates recovery. It is useful for UI development but is not persistence or
native product behavior. Proof captured from that surface cannot certify
Electron persistence, devices, packaging, or media output.

### P1 — UI runtime error and responsive regression

The current Production canvas renders a button inside another button for the
display layer and capture activator. React reports this as invalid HTML with a
hydration warning. At the audit browser's narrower viewport, the Production
layout horizontally scrolled, the canvas largely disappeared, and inspector
controls overlapped or compressed. The old certified screenshots therefore do
not certify today's current source at all relevant sizes.

### P1 — Maintainability has crossed the prototype threshold

- `App.tsx`: approximately 1,747 lines.
- `styles.css`: approximately 3,145 lines.
- `ffmpeg-media.ts`: approximately 1,011 lines.
- Device, destination, and stream lifecycle logic is duplicated.
- Lint currently fails; formatting check reports every inspected source/test
  file as nonconforming.
- Renderer bundle is approximately 984 KB minified and emits a chunk warning.

Impact: adding the missing product workflows to this shape will increase
coupling and regression risk.

### P1 — Test count overstates product coverage

Twenty-one of 29 tests cover URL validation, clamping, encoder choice, and
device validation. Six cover the Show core, and two cover device parsing and
redaction. There are no automated UI flows, Media Host integration tests,
Program-to-recording parity tests, real audio-route tests, destination fault
tests against a server, packaged media tests, or endurance tests.

## Retain, rebuild, remove

| Current area | Decision | Reason |
|---|---|---|
| Command/revision concepts | Retain and evolve | Sound control-plane base |
| Journal/checkpoint/export | Retain and move to SQLite WAL | Useful recovery foundation |
| Pulse owner component | Retain behind compositor adapter | Correct lifecycle pattern |
| FFmpeg parsing/redaction tests | Retain | Valuable bounded utilities |
| ScreenRecorder adapter | Retain in Diagnostics only | Real but not live compositor |
| Electron shell/security flags | Retain and harden | Good renderer boundary |
| `App.tsx` production surface | Rebuild by workspace/domain | Prototype monolith |
| Global stylesheet | Rebuild as tokens/components/layouts | Too large and conflicting |
| Browser bridge | Keep dev-only | Cannot be product authority |
| Hard-coded Foundation Show | Remove from default flow | Demo, not creation workflow |
| Simulated audio console | Remove from product UI | Does not affect samples |
| Mock destination tray | Remove from product UI | Disconnected from transport |
| Duplicate Settings media hook | Remove | Conflicting ownership/dead controls |
| Direct camera/mic live path | Demote to proof adapter | Bypasses Program |
| Command-line secret path | Remove before live work | Violates security boundary |
| Stale native build output/docs | Archive or delete after baseline | Misleading evidence |

## Required reboot sequence

1. Establish repository truth: initialize Git, clean generated artifacts,
   align scripts/docs/names, and restore green lint/format/package smoke.
2. Build an isolated Media Host and a single authoritative Program video path.
3. Record that Program path and prove exact scene/source/transition parity.
4. Add real WASAPI routing and prove the Program mix and A/V sync.
5. Replace the demo gate with Show library and real CRUD workflows.
6. Add vault-backed one-destination output from Program.
7. Prove recovery, packaged behavior, endurance, responsive UI, and faults.
8. Only then add Pulse graphics to Program, vertical output, multistreaming,
   engagement, replay, captions, and assistants.

## Promotion decision

Current product promotion status: **FAIL_BINDING**.

The current UI can remain as an internal Foundation/diagnostic reference, but
it must not be promoted as the visual or interaction baseline for the rebuilt
product. The July UI certificate applied to a Foundation surface and does not
prove the current source, packaged app, or production workflow.

The repository does not need to be discarded. It needs a controlled
architecture and product reboot with the media spine built before feature
surfaces.

## Audit evidence created in this run

- `output/playwright/audit-gate.png`
- `output/playwright/audit-studio.png`
- `output/playwright/audit-studio-1440.png`
- `output/playwright/audit-settings.png`
- `output/playwright/audit-diagnostics.png`

These are current Vite-renderer evidence, not Electron, packaged, native, or
live-stream proof.
