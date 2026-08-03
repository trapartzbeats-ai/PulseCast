# PulseCast Studio Master Blueprint

Version: 2.0 product reboot  
Status: authoritative build contract  
Date: 2026-08-03  
Replaces: the Foundation-first v1 blueprint, archived at
`docs/archive/PULSECAST_MASTER_BLUEPRINT_V1_LEGACY.md`

## 1. Product decision

PulseCast Studio is a Windows-first live production application for creators
who need to build a show, understand its audio, record it, and broadcast it
without assembling several unrelated tools.

The first complete product is not a feature sampler. It is a trustworthy
single-destination broadcaster and recorder. Graphics, multistreaming,
engagement, replay, captions, and assistant workflows may expand that product
only after its media spine is certified.

The non-negotiable promise is:

> The picture and mix shown as Program are the exact picture and mix sent to
> every enabled recording and destination.

Any path that bypasses the Program compositor or Program audio bus is a proof
adapter, not product output.

## 2. Release 1.0 outcome

A first-time Windows user can:

1. Install and launch PulseCast without development tooling.
2. Complete camera, microphone, desktop-audio, encoder, network, and disk
   preflight checks.
3. Create, name, save, reopen, duplicate, and delete a Show.
4. Add a camera, display/window capture, image, video, microphone, desktop
   audio, owned remote stream, and Pulse graphic through an Add Source flow.
5. Create and reorder scenes, arrange layers directly on canvas, and preview a
   scene without changing Program.
6. Take or transition Preview to Program.
7. Route real audio to Program, Monitor, and Record, with real meters, mute,
   gain, gate, and limiter behavior.
8. Produce and automatically validate a 30-second recording of the Program
   picture and mix.
9. Store Twitch and Facebook destination secrets in Windows Credential Manager
   and run safe bandwidth or test-endpoint checks.
10. Route Program to Twitch, Facebook, or both with an explicit confirmation
    transaction and independent destination controls.
11. Add or remove a destination route without rebuilding the Show, subject to
    a guarded live-change policy.
12. See connection, dropped-frame, encoder, audio, disk, recording, and
    per-destination health while live.
13. Stop outputs cleanly, locate the recording, reopen the Show, and recover it
    after forced UI termination.
14. Add an official PS Remote Play window as a PlayStation source, capture its
    process audio, add a local camera/microphone/graphics, and route the final
    Program to Twitch, Facebook, or both.
15. Optionally use the longer-latency Twitch Bridge workflow: broadcast PS5
    gameplay to the creator's Twitch channel, ingest that owned playback into
    PulseCast, synchronize local sources, and route Program to Facebook.

Release 1.0 is not complete if any of those steps depends on a mock,
placeholder, synthetic signal, browser-only state, manual JSON editing, or a
separate proof route.

## 3. Product principles

### 3.1 Program truth

- Program is the sole source for recording and streaming outputs.
- Preview is visibly distinct from Program.
- A source marked real must contribute real frames or samples to Program.
- UI state is never accepted as proof of media state.

### 3.2 Creator language

- Use Audience, You, and Recording in primary UI.
- Keep Program, Monitor, and Record as secondary technical labels.
- Hide adapter names, process IDs, and proof classifications in Diagnostics.
- Every failure message states what failed, whether output continues, and the
  next safe action.

### 3.3 One coherent workflow

Home, setup, editing, rehearsal, preflight, live operation, recording review,
and recovery are parts of one Show lifecycle. Test tools support that
workflow; they are not separate products inside the app.

### 3.4 Safe output

- No network output begins from a single accidental click.
- Secrets never enter Show files, renderer state, logs, recovery journals,
  command-line arguments, screenshots, or diagnostics packages.
- Starting output is a previewable transaction with named destinations and
  expected Program format.
- Local recording starts before network output unless the user explicitly
  opts out.

### 3.5 Progressive complexity

The default workspace exposes the controls required to prepare and run a
show. Advanced routing, encoder tuning, color controls, and diagnostics are
available without occupying the primary operating surface.

## 4. Scope

### 4.1 Release 1.0

- Windows 11 x64.
- One 1920 x 1080 canvas at 30 or 60 fps.
- Camera, display/window, official PS Remote Play window, image, video, owned
  remote stream, microphone, desktop/process audio, and Pulse graphic sources.
- Scenes, Preview, Program, cut, and dissolve.
- Program, Monitor, and Record buses.
- H.264 video and AAC audio.
- MKV or fragmented MP4 crash-resistant recording plus finalized MP4 export.
- Twitch and Facebook RTMPS destinations, selectable independently or
  simultaneously from one Program feed.
- Autosave, undo/redo, checkpoints, crash recovery, logs, and diagnostics.
- Signed installer and in-place update readiness.

### 4.2 Release 1.1

- Simultaneous horizontal and vertical canvases.
- Destination-specific framing.
- A visual Pulse graphics/template workspace.
- YouTube destination adapter and reusable destination-route presets.

### 4.3 Release 1.2

- Twitch/YouTube chat and engagement event normalization.
- Destination-aware alerts and goals.

### 4.4 Release 1.3

- Replay buffer, markers, clip extraction, captions, and vertical clip export.

### 4.5 Later platform work

- Relay distribution, remote guests, teams, marketplace, extension SDK,
  assistant transactions, and mobile control.

Facebook RTMPS routing in Release 1.0 uses a user-provided Server URL and
vault-backed stream key from Facebook Live Producer. Deeper Facebook account,
metadata, chat, and engagement APIs are added only after their current
permissions, review path, and test environment are documented and proven.

## 5. Information architecture

### 5.1 Home

Home is a Show library, not a marketing gate. It provides:

- New Show
- Open Show
- Recent Shows with last-opened time and health
- Duplicate, rename, archive, and delete
- Recover interrupted Show
- Global devices and application settings

The bundled demo is optional and never replaces Show creation.

### 5.2 Setup

First-run and per-Show setup contain:

- device selection with live preview and meters;
- encoder capability test;
- recording folder and disk-speed/free-space check;
- destination connection and vault-backed credential setup;
- 30-second Program recording test with automatic inspection;
- a single readiness summary with blocking and non-blocking items.

Console Bridge setup additionally provides:

- selection and validation of the official PS Remote Play window;
- WASAPI process-audio capture for Remote Play;
- Twitch channel ownership/account confirmation;
- selection of the dedicated Twitch player window or an authorized remote
  feed URL;
- upstream latency measurement and drift monitoring;
- adjustable delay for local camera and microphone;
- a synchronization test before Facebook routing is enabled.

### 5.3 Studio workspace

The default desktop workspace is:

```text
Top bar: Show | Save state | Output health | Record | Go Live
Left: Scenes and Sources
Center: Preview and Program canvases
Right: Context inspector and source properties
Bottom: Real audio mixer and transition controls
Status rail: blocking faults, recording time, stream time, CPU/GPU/network/disk
```

Minimum supported viewport is 1280 x 720. At that size, Program, Preview,
scene selection, transition, Record, Stop, and critical health remain visible
without horizontal page scrolling. Panels may collapse; core controls may not
disappear.

### 5.4 Live state

When output is active:

- editing that can break Program is guarded;
- Stop is persistent and visually unambiguous;
- Program and audio health get priority over library and setup controls;
- destination state distinguishes connecting, live, degraded, reconnecting,
  failed, and stopped;
- the operator can confirm that local recording continues during destination
  failure.

### 5.5 Diagnostics

Diagnostics is a secondary workspace. It reports evidence using only:
`real`, `fault-injected-real`, `simulated`, `mock`, or `unavailable`.

It must not expose a capability as product-ready merely because an adjacent
binary exists or a bounded proof succeeded.

## 6. Authoritative runtime architecture

### 6.1 Process model

```text
PulseCast.exe (Electron shell and supervisor)
├── Renderer (UI only; no secrets or authoritative media state)
├── Core service (Show commands, SQLite WAL, undo/redo, recovery)
└── PulseCastMediaHost.exe (isolated native media data plane)
    ├── capture graph
    ├── D3D11 compositor
    ├── audio graph
    ├── encoder/recorder
    └── destination router and transports

Optional later adapter:
PlayStationSourceHost.exe
└── separately distributed, source-published Remote Play protocol adapter
```

Release 1.0 uses one isolated Media Host to avoid premature distributed-system
complexity. The boundary must allow the destination and graphics hosts to be
split later without changing Show schemas.

The renderer may crash and restart without terminating Media Host. The shell
supervises both Core and Media Host, preserves live status, and reattaches the
renderer.

### 6.2 Control plane

- TypeScript schemas are generated from versioned JSON Schema or Protobuf
  definitions shared with native code.
- Commands carry command ID, idempotency key, Show ID, base revision, actor,
  correlation ID, and mode.
- Core validates and persists accepted Show mutations before acknowledging
  them.
- Runtime media commands return accepted/rejected state and emit telemetry;
  they do not mutate the Show implicitly.
- UI derives from authoritative snapshots and event streams, never optimistic
  local duplicates for critical state.

### 6.3 Media plane

- Capture and composition use native Windows APIs and D3D11 textures.
- Frame descriptors include adapter LUID, shared handle, synchronization,
  monotonic timestamp, dimensions, pixel format, and color space.
- The compositor owns Preview and Program render targets.
- Program video feeds both recorder and the destination router from the same
  frame clock.
- Audio uses WASAPI capture and shared-memory float buffers.
- Program audio feeds both recorder and destination encoder from the same
  post-processing bus.
- Renderer preview receives a presentation surface; raw production frames and
  samples never travel as JSON IPC or browser MediaStreams.

### 6.4 Media graph

```text
Sources -> Source transforms -> Scene compositor -> Preview
                                      |
                                  Take/transition
                                      v
                                   Program -> Recorder
                                      |
                                      +-> Encoder -> Destination router
                                                      ├-> Twitch RTMPS
                                                      └-> Facebook RTMPS

Mic/Desktop -> gain/DSP/routes -> Program/Monitor/Record buses
                                      |                |
                                      +-> encoder AAC  +-> isolated tracks
```

An official PS Remote Play window, owned Twitch playback, or other authorized
remote stream enters the graph as a source, never as a destination. Its video
and audio timestamps become the reference for delayed local camera/microphone
sources when synchronization is required.

The graph must expose stable source IDs and lifecycle states: creating, ready,
active, stalled, disconnected, retrying, failed, and stopped.

### 6.5 Technology direction

- Native: C++20, D3D11, DXGI Desktop Duplication or Windows Graphics Capture,
  WASAPI, Media Foundation where suitable, and a licensed transport/mux layer.
- UI: Electron, React, TypeScript.
- Persistence: SQLite WAL for the live authoritative store; `.pcast` as a
  portable, checksummed export/import container.
- Graphics: Pulse Core through a versioned adapter whose final pixels enter
  the native Program compositor.
- PlayStation Phase 1: Windows Graphics Capture of the official PS Remote Play
  window plus WASAPI per-process audio capture.
- PlayStation Phase 2: an optional out-of-process adapter informed by
  chiaki-ng or PyRemotePlay only after license and legal review. No AGPL/GPL
  code is copied or linked into the proprietary PulseCast core by default.
- Adjacent projects: public, versioned process/library adapters only.

FFmpeg CLI may remain a test adapter and transitional encoder harness. It may
not be the product stream path while it receives raw camera/microphone input
that bypasses Program.

## 7. Product data model

### 7.1 Show

A Show contains:

- identity and schema version;
- canvas definitions;
- reusable source definitions;
- scenes and ordered layers;
- transition defaults;
- audio channels, buses, snapshots, and processors;
- destination references with opaque credential references;
- recording settings;
- graphics and assets;
- UI workspace state that is safe to persist;
- compatibility requirements and migration history.

Runtime health, process IDs, raw secrets, device handles, active MediaStreams,
and transient meters are not Show content.

### 7.2 Scenes and rundown

Release 1.0 uses scenes as the primary operating model. A rundown may order
and annotate scenes but does not replace scene CRUD. Preview selection and
Program activation are separate runtime states.

### 7.3 Assets

Assets are referenced by stable IDs and original paths, with optional managed
copies. Missing assets surface a relink workflow. Export can embed selected
assets and includes checksums.

### 7.4 Migrations

- Every schema has a version.
- Opening an older Show creates a backup before migration.
- Forward-incompatible Shows open read-only with a precise message.
- Migration tests use fixture files for every supported prior version.

## 8. Audio requirements

- Real peak and RMS meters with clipping, silence, and disconnected states.
- Gain range -60 dB to +12 dB and deterministic mute behavior.
- Program, Monitor, and Record route matrices affect real samples.
- Monitor prevents accidental feedback and clearly names the selected device.
- Gate and limiter parameters have usable defaults and bypass controls.
- Audio/video synchronization target is within 20 ms for a 30-minute run.
- Device removal does not crash the Show; it produces a named fault and a
  reconnection path.
- Optional isolated microphone and desktop-audio tracks are recorded in
  addition to the Program mix.

## 9. Video and graphics requirements

- 1080p30 is the mandatory baseline; 1080p60 is promoted only on hardware that
  passes preflight.
- Camera and screen capture have crop, position, scale, opacity, visibility,
  and fit/fill controls.
- Cut and dissolve must be frame-clocked and visible in the encoded recording.
- Program frames shown in UI and inspected from recordings must match within
  defined color and scaling tolerances.
- Pulse graphic entrance, loop, exit, transparency, reduced motion, restart,
  and failure behavior are tested through the compositor.
- A graphics-host failure cannot stop audio, recording, or destination output;
  the last safe graphic frame is removed or held according to policy.

### 9.1 PlayStation Source and remote-stream ingest

The primary PlayStation workflow is:

```text
PS5 -> official PS Remote Play -> native window + process-audio capture
                                -> PulseCast compositor
                                   + local camera/mic/graphics
                                -> Program -> Twitch and/or Facebook
```

This is Release 1.0 because it uses Sony's supported client while PulseCast
focuses on its actual product responsibilities: capture, composition, audio,
recording, routing, health, and recovery. Ethernet is recommended for both the
PS5 and production PC. PulseCast must report the extra Remote Play encode,
decode, and transport latency rather than hiding it.

The deeper Phase 2 source is:

```text
PS5 -> PlayStation Remote Play protocol -> PlayStationSourceHost.exe
                                      ├-> decoded video frames
                                      ├-> decoded audio frames
                                      ├-> optional controller input
                                      └-> connection statistics
                                           -> PulseCast compositor
```

`Add Source -> PlayStation 5` discovers consoles, guides registration, and
shows LAN/remote connection, video, audio, controller, bitrate, latency,
packet-loss, and reconnect state.

Chiaki-ng is currently AGPL-3.0 and PyRemotePlay is GPL-3.0. Therefore:

- PyRemotePlay may be used for a disposable local proof, not silently shipped
  inside PulseCast;
- a Chiaki-ng-derived implementation must be a clearly separated optional
  process with its corresponding source, license, notices, and build scripts
  published as required;
- PulseCast must obtain legal review before distributing that adapter with a
  proprietary application;
- registration keys, account identifiers, PSN tokens, and console secrets use
  the vault boundary and never enter Shows or diagnostics;
- the official Remote Play window-capture path remains available regardless of
  whether the optional adapter is installed.

The optional Twitch Bridge workflow is:

The required creator workflow is:

```text
PS5 -> creator's Twitch channel -> PulseCast remote source
                                      + local camera/mic/graphics
                                      -> Program -> Facebook
```

PulseCast supports two additional remote-source modes:

1. **Twitch Window Source** — native capture of a dedicated, visible Twitch
   player window opened by the creator, including its loopback audio. This is
   the first supported path because Twitch documents an approved player embed
   but does not document a general raw live-playback manifest API for desktop
   production software.
2. **Authorized Remote Feed** — HLS, SRT, or RTMP input supplied by the creator
   or a future approved service adapter. Credentials and URLs use the vault
   boundary.

PulseCast must not scrape private Twitch playback tokens, depend on an
undocumented manifest endpoint, remove Twitch player requirements, or claim an
official Twitch ingest integration without an approved API path.

Remote-source requirements:

- creator confirms ownership or authorization for the captured channel;
- Twitch source state includes connecting, buffering, live, stalled,
  reconnecting, offline, and failed;
- source latency, jitter, buffer depth, decoded frame rate, resolution, and
  audio presence are visible;
- local camera and microphone support a bounded delay buffer sufficient to
  match the Twitch source;
- an automatic sync assistant estimates offset, while the creator retains a
  manual fine adjustment;
- Program does not go live to Facebook until the Twitch source is stable and
  sync is within the configured tolerance;
- upstream Twitch loss activates a creator-selected slate while local camera,
  recording, and Facebook destination health remain operational;
- the Show records the source configuration and delay values but never Twitch
  cookies, OAuth tokens, or private playback URLs;
- the workflow includes a current Twitch simulcast-guideline acknowledgement.

This path necessarily adds the Twitch delivery and playback delay before
PulseCast can compose the feed. A capture card or local PS Remote Play window
remains the lower-latency alternative, but it does not replace the requested
Twitch-source workflow.

## 10. Recording and destination requirements

### 10.1 Recording

- Recording is a first-class top-bar action, not a diagnostic proof.
- Use a crash-recoverable container during capture.
- Validate codec, dimensions, frame rate, duration, audio codec, audio signal,
  A/V sync, and non-zero packets after stop.
- Low disk space and write failure create blocking, actionable faults.
- A destination failure must not corrupt or stop local recording.

### 10.2 Destination routing

- Release 1.0 supports Twitch, Facebook, or both as active RTMPS destinations.
- Routing originates from PulseCast Program. Twitch is never treated as a
  source that forwards media to Facebook.
- When destinations share an encoding profile, PulseCast encodes once and
  fans out the encoded packets. Incompatible platform profiles require
  separate encoder branches and an explicit capacity warning.
- Each destination has an independent enabled route, credential reference,
  lifecycle, retry policy, health record, and stop action.
- A failed destination cannot stop the other destination or local recording.
- Adding or removing a route while live is a guarded transaction that previews
  the destination and resource impact before applying it.
- Secret lookup occurs in Media Host immediately before connect.
- Stream keys are never command arguments; use an inherited protected handle,
  private IPC message, or vault lookup by opaque ID.
- Health includes DNS, connect, TLS, authentication, bitrate, sent frames,
  dropped frames, reconnect attempt, and last server error when available.
- Reconnect uses bounded exponential backoff and never starts duplicate output.
- Production output requires a successful test or an explicit, logged override.

## 11. Persistence, recovery, and undo

- SQLite WAL is the transaction boundary for commands, events, projections,
  checkpoints, and idempotency records.
- Autosave happens after accepted mutations without a manual Save button.
- Undo/redo is available for reversible Show edits and excluded for live output
  start/stop, credential changes, and destructive file operations.
- A clean checkpoint is created before going live.
- After UI termination, a restarted renderer attaches to the continuing Media
  Host and reconstructs authoritative state.
- After Media Host failure, Core preserves the Show and recording recovery
  information, then offers a guarded restart.
- Last-known-good recovery cannot silently discard changes; it previews the
  revision and timestamp that will be restored.

## 12. Security and privacy

- Windows Credential Manager is mandatory before real platform output.
- IPC schemas reject unknown fields, oversized inputs, invalid URLs, invalid
  device IDs, and unsupported transitions.
- Renderer uses context isolation, no Node integration, a strict CSP, and a
  narrow preload bridge.
- All logs and diagnostic exports pass secret-redaction tests.
- Privacy mode suppresses preview thumbnails and source names in diagnostic
  packages.
- Packaging is code-signed before public release.
- Dependencies, licenses, bundled codecs, and FFmpeg configuration are
  inventoried before distribution.

## 13. Performance budgets

On the declared baseline machine with one camera, one 1080p display capture,
one Pulse overlay, microphone, and desktop audio:

- 1080p30 Program: sustained for 60 minutes with no unbounded memory growth.
- Preview-to-Program visual latency: <= 100 ms.
- Audio monitor latency: <= 80 ms where the selected device supports it.
- A/V sync: within 20 ms over 30 minutes.
- Compositor missed frames: < 0.1% after warmup.
- UI remains responsive while recording and streaming.
- Renderer restart does not interrupt Media Host output.
- CPU, GPU, encoder, memory, network, and disk metrics are sampled and included
  in the proof report.

Targets are promoted only with `real` evidence on named hardware.

## 14. Repository architecture

```text
PulseCast/
├── apps/
│   └── desktop/                 Electron shell and React UI
├── services/
│   ├── core/                    Show commands, SQLite, recovery
│   └── media-host/              Native media runtime
├── packages/
│   ├── contracts/               Generated cross-process schemas
│   ├── show-model/              Pure Show rules and migrations
│   ├── ui-system/               Tokens and production components
│   └── pulse-adapter/           Canonical Pulse integration
├── adapters/
│   ├── screen-recorder-proof/   Bounded proof only
│   ├── ourconsole/
│   └── destinations/
├── tests/
│   ├── unit/
│   ├── contract/
│   ├── integration/
│   ├── endurance/
│   └── fixtures/
├── reports/
│   ├── ui-proof/
│   ├── media-proof/
│   └── release-proof/
├── docs/
└── tools/
```

No feature component should repeat device, credential, or stream lifecycle
state. One application-level media controller owns it and projects it into
workspaces.

## 15. Build program and promotion gates

### Gate 0: repository truth

Deliver:

- initialize Git and commit a known baseline;
- remove generated build/runtime caches from source scope;
- align README, scripts, package identity, security docs, and acceptance docs;
- make typecheck, unit tests, lint, format, and package smoke pass;
- establish CI and artifact checksums;
- create a capability ledger with current proof labels.

Exit: a clean clone can verify and package the same product with no stale
commands or mislabeled artifacts.

### Gate 1: Program video spine

Deliver:

- Media Host process and supervisor contract;
- one real camera and one real display/window source;
- one real official PS Remote Play window source;
- D3D11 compositor with transforms;
- Preview and Program separation;
- cut/dissolve;
- a recording produced from Program frames.

Exit proof: a 10-minute real recording contains the exact camera and official
PS Remote Play window, transforms, Pulse-free scene changes, and transitions
shown on Program.

### Gate 2: Program audio spine

Deliver:

- WASAPI microphone and desktop audio;
- WASAPI per-process audio for the official PS Remote Play client;
- real buses, meters, gain, mute, gate, limiter, and monitor;
- Program mix plus isolated recording tracks;
- device removal/recovery.
- remote-source reference timing and bounded camera/microphone delay.

Exit proof: a 30-minute recording passes signal, clipping, silence, isolated
track, remote-source synchronization, and A/V sync checks. Every visible route
changes real samples.

### Gate 3: product editing workflow

Deliver:

- Show library and CRUD;
- source and scene CRUD;
- direct canvas editing and inspector;
- autosave, undo/redo, asset relink, import/export, and migrations;
- first-run setup and 30-second test recording.

Exit proof: a new user can build a camera-plus-screen Show from an empty
library, close it, reopen it identically, and recover it after forced UI exit.

### Gate 4: trustworthy destination routing

Deliver:

- Credential Manager adapter;
- Twitch and Facebook RTMPS routes from Program video and Program audio;
- independent route enablement, readiness, test, health, reconnect, and stop;
- shared-encode fan-out for compatible destination profiles;
- recording continuity during network faults.

Exit proof: two non-production endpoints receive the same inspected A/V as the
local Program recording; failure of either endpoint leaves the other route and
local recording uninterrupted. Controlled Twitch and Facebook production tests
are separately authorized and evidenced.

Twitch Bridge exit proof: a PS5 broadcasts to the creator's Twitch channel;
PulseCast ingests the dedicated Twitch player window, synchronizes a local
camera and microphone, composes them into Program, records Program, and routes
the same Program to a separately authorized Facebook test. Twitch source loss
shows the configured slate without crashing or leaking credentials.

### Gate 5: Release 1.0 hardening

Deliver:

- renderer restart and Media Host restart policies;
- 60-minute, 4-hour, and 8-hour endurance runs;
- low disk, encoder reset, camera removal, audio removal, DNS failure, TLS
  failure, and network interruption tests;
- accessibility, keyboard, reduced-motion, 1280 x 720, 1440 x 900, and high-DPI
  UI proof;
- signed installer, update readiness, uninstall behavior, and packaged smoke.

Exit: all Release 1.0 outcomes pass from the packaged application. No mock or
simulated capability satisfies an acceptance gate.

### Gate 6: Pulse and vertical production

Deliver:

- Pulse pixels in Program compositor;
- graphic editor and templates;
- vertical canvas and destination-aware framing;
- graphics-host failure containment.

Exit proof: horizontal and vertical recordings show deterministic Pulse
animation and source framing without harming Program continuity.

### Gate 6A: native PlayStation source adapter

Deliver:

- separately licensed `PlayStationSourceHost.exe`;
- LAN console discovery, guided registration, connect, wake, and reconnect;
- decoded video/audio surfaces and connection telemetry;
- optional controller forwarding;
- public versioned adapter contract and source/build publication required by
  the selected upstream license;
- official Remote Play fallback.

Exit proof: packaged PulseCast connects to an authorized PS5 on LAN, records
the same decoded frames/audio shown in Program, reconnects after a controlled
network fault, and proves that no console secret entered the Show or diagnostic
export. Distribution and source-offer compliance are reviewed separately.

### Gate 7: platform and creator expansion

Add multistreaming, additional platforms, chat, engagement, alerts, replay,
captions, and clips one vertical slice at a time. Each slice includes real
adapter proof, UI workflow, persistence, recovery, security, endurance, and
packaged evidence before promotion.

## 16. Current-code migration

### Retain and harden

- revisioned command envelope and conflict concepts;
- Show model ideas, with new schemas and migrations;
- journal/checkpoint/checksummed `.pcast` concepts;
- Pulse lifecycle ownership and cleanup;
- media device parsing, encoder selection, redaction, and validation tests;
- Electron isolation and narrow bridge pattern;
- packaged proof discipline and evidence labels.

### Replace

- the single hard-coded Foundation Show;
- browser/in-memory bridge as a product runtime;
- the monolithic `App.tsx` and global stylesheet;
- duplicate `useMediaDevices` ownership and duplicate destination forms;
- simulated audio routing presented beside real preview media;
- mock destination tray disconnected from FFmpeg health;
- direct camera/mic FFmpeg output that bypasses Program;
- command-line stream-key transport;
- Foundation/Real Media Test product naming and stale scripts/docs;
- UI controls for features with no end-to-end product effect.

### Temporary adapters

The existing ScreenRecorder and FFmpeg paths may remain under Diagnostics as
bounded proofs while Gates 1-4 are built. They are never used to claim that
the product compositor, audio graph, recorder, or destination is complete.

## 17. Test and evidence contract

Every promoted capability must have:

- unit tests for pure rules;
- cross-language contract tests;
- integration tests across the real process boundary;
- fault-injection tests for failure and recovery;
- runtime media artifacts inspected by ffprobe or equivalent;
- UI screenshots and state coverage from the packaged app;
- performance data on named hardware;
- a proof label and explicit limitations.

Release proof separates:

1. source/unit proof;
2. local renderer proof;
3. Electron development proof;
4. native media proof;
5. packaged application proof;
6. non-production destination proof;
7. controlled production live proof.

Passing one level never implies the levels after it.

## 18. Definition of done

A feature is done only when:

- its user workflow is complete, discoverable, and reversible where safe;
- UI state is bound to authoritative runtime state;
- the real Program media path is affected as designed;
- persistence and recovery preserve it;
- secrets and diagnostics obey the security boundary;
- default, loading, empty, active, degraded, error, and recovery states are
  implemented;
- automated tests and packaged runtime evidence pass;
- docs and the capability ledger are updated in the same change;
- its proof label is honest.

## 19. Product success statement

PulseCast is ready to grow beyond Release 1.0 only when creators can truthfully
say:

- “The stream matched what I saw and heard in Program.”
- “I understood where my audio was going.”
- “I could build and reopen a real Show, not just edit a demo.”
- “My recording survived when the network did not.”
- “When something failed, PulseCast told me what continued and what to do.”

That reliable broadcaster is the foundation of the full PulseCast product.
Everything else is expansion, not a substitute.
