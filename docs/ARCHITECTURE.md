# PulseCast Architecture

Status: Gate 1 in progress under the v2 master blueprint.

## Current implementation

```text
Electron main process
├── command runtime
├── JSON projection + JSONL journal
├── checkpoint/recovery/export
├── bounded media proof IPC
├── adapter inventory
└── supervised PulseCastMediaHost.exe
    ├── versioned JSONL command/probe contract
    ├── real Win32 Remote Play window discovery
    ├── Windows Graphics Capture + D3D11 frame acquisition
    ├── capture lifecycle, resolution, frame, and stall telemetry
    ├── keyed shared-texture publisher + second-device consumer
    ├── child-HWND source-preview presentation
    ├── process audio: unavailable
    └── Program composition: unavailable

Electron renderer
├── retained Foundation workspace
├── one application-level device controller
├── browser camera/mic and display preview
├── Pulse Core graphic owner
├── native Settings and Production source-monitor bounds
├── simulated audio routing
└── mock Foundation destinations
```

The current renderer is a retained control-plane prototype. Browser media
preview is not the Program compositor. The Media Host is now a real native and
packaged process boundary. It now opens real Windows Graphics Capture sessions
and consumes native D3D11 frames, but only the labeled mock-window path has
been proven. The Media Host now copies capture frames into a keyed NT-handle
shared texture, reopens it on a second D3D11 device, and presents it through a
native child HWND parented to Electron. Renderer JSON carries only validated
bounds and telemetry; raw pixels remain native. The surface is a source
monitor, not the Program compositor, and only the labeled mock-window path has
been proven. Official Sony Remote Play, a connected PS5, process audio, and
Program composition remain open. The FFmpeg DirectShow worker is a bounded
proof adapter and its network start IPC is disabled.

## Required product architecture

```text
PulseCast.exe (Electron shell and supervisor)
├── renderer: UI only
├── Core service: Show commands, SQLite WAL, undo/redo, recovery
└── PulseCastMediaHost.exe
    ├── real capture graph
    ├── D3D11 Preview/Program compositor
    ├── WASAPI Program/Monitor/Record buses
    ├── recorder and encoder
    └── destination router
        ├── Twitch RTMPS
        └── Facebook RTMPS
```

Program frames and Program audio are the sole input to recording and
destination routing. Compatible destination profiles share one encode and fan
out encoded packets. Each destination retains independent lifecycle, health,
reconnect, and stop state.

The primary PS5 workflow captures the official PS Remote Play window plus its
WASAPI process audio, composites local camera/microphone/graphics, and routes
Program to Twitch and/or Facebook. The optional Twitch Bridge treats the
creator's Twitch playback as an input source and never as a forwarding
transport.

A later `PlayStationSourceHost.exe` may connect directly to an authorized PS5
and expose decoded frames, audio, controller input, and statistics. Chiaki-ng
is AGPL-3.0 and PyRemotePlay is GPL-3.0, so this adapter remains out of process,
separately licensed and source-published, and subject to legal review. The
official Remote Play capture path remains the fallback.

Frames and samples never travel through renderer JSON IPC or browser
MediaStreams. The current preview contract sends a parent window handle,
physical-pixel bounds, state, counters, dimensions, and a shared-handle
descriptor; the actual capture texture remains in the native data plane.
Cross-process contracts are versioned and validated.

## Persistence migration

The current atomic JSON projection and JSONL journal are `real` Foundation
proof. Before live output, accepted commands, events, projections, checkpoints,
and idempotency keys move into SQLite WAL transactions. `.pcast` remains a
checksummed portable import/export container.

## Upstream adapters

- Pulse Core is consumed as a pinned public npm package artifact.
- ScreenRecorder remains a bounded display-to-MP4 proof adapter.
- OURconsole requires a public library or versioned process protocol.
- Unified Render Engine remains an offline worker, not a live compositor.

Adjacent applications are not copied into PulseCast.
