# PulseCast Reboot Build Tracker

Authority: `PULSECAST_MASTER_BLUEPRINT.md`

## Gate 0 — Repository truth

- [x] Replace the master blueprint and preserve v1.
- [x] Complete the product audit.
- [x] Initialize Git and Git LFS.
- [x] Pin Pulse Core as a public package artifact.
- [x] Align PulseCast product identity.
- [x] Remove renderer destination credentials and disable unsafe output IPC.
- [x] Define Twitch + Facebook Program routing in Release 1.0.
- [x] Pass lint and format.
- [x] Pass typecheck and all tests.
- [x] Pass renderer/main build and adapter inventory.
- [x] Build Windows artifacts and pass packaged smoke.
- [x] Commit the verified baseline.

## Gate 1 — Program video spine

- [x] Media Host executable and supervisor contract.
- [x] Real Win32 discovery of official PS Remote Play windows.
- [x] Windows Graphics Capture session lifecycle and real frame telemetry.
- [x] Keyed D3D11 shared-texture presentation in Settings and Production source monitors.
- [ ] Real camera capture.
- [ ] Real display/window capture.
- [ ] Official PS Remote Play window source.
- [ ] WASAPI process audio for PS Remote Play.
- [ ] Twitch Window Source for an optional owned-channel bridge.
- [ ] D3D11 scene compositor.
- [ ] Separate Preview and Program.
- [ ] Cut and dissolve.
- [ ] Program-frame recording.
- [ ] Ten-minute parity proof.

## Gate 2 — Program audio spine

- [ ] WASAPI microphone and desktop audio.
- [ ] Real Program, Monitor, and Record buses.
- [ ] Remote-source latency measurement and local camera/mic delay.
- [ ] Real meters, gain, mute, gate, and limiter.
- [ ] Program mix and isolated tracks.
- [ ] Thirty-minute A/V sync proof.

## Gate 3 — Product workflow

- [ ] Show library and Show CRUD.
- [ ] Scene and source CRUD.
- [ ] Direct canvas editing.
- [ ] Undo/redo and SQLite WAL.
- [ ] Asset relink and migrations.
- [ ] First-run setup and Program recording test.

## Gate 4 — Twitch + Facebook routing

- [ ] Windows Credential Manager adapter.
- [ ] Independent Twitch and Facebook route controls.
- [ ] Shared-encode fan-out for compatible profiles.
- [ ] Independent health, reconnect, and stop.
- [ ] Guarded live route add/remove.
- [ ] Two-endpoint parity and failure-isolation proof.
- [ ] PS5 -> Twitch -> PulseCast + camera -> Facebook Console Bridge proof.

## Gate 5 — Release 1.0 hardening

- [ ] Renderer reattach and Media Host recovery.
- [ ] Fault-injection matrix.
- [ ] Eight-hour endurance proof.
- [ ] Responsive, accessibility, DPI, and reduced-motion proof.
- [ ] Signed installer and packaged product proof.

## Gate 6A — Native PlayStation source

- [ ] PyRemotePlay local proof and findings report.
- [ ] Chiaki-ng AGPL integration/legal decision.
- [ ] Separate PlayStationSourceHost process and public adapter contract.
- [ ] Console discovery, registration, video, audio, controller, and metrics.
- [ ] Source/build publication and license notices.
- [ ] Official Remote Play fallback.
