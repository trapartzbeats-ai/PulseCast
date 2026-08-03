# PulseCast Capability Ledger

Updated: 2026-08-03  
Product baseline: 0.3.0-reboot

This ledger describes current source. Historical reports do not override it.

| Capability | Proof | Product binding | Promotion |
|---|---|---|---|
| Command validation/revisions | real | Retained Foundation core | retain |
| JSON projection/journal | real | Retained Foundation core | migrate to SQLite |
| Checkpoint/recovery | real | Show state only | retain and expand |
| `.pcast` export | real | Hard-coded demo export | rebuild workflow |
| Pulse renderer | real | Renderer pixels only | adapter pending |
| Camera/mic browser preview | real | Renderer preview only | proof only |
| Display browser preview | real | Renderer preview only | proof only |
| Native Media Host process contract | real | Supervised C++20 JSONL process | expand in Gate 1 |
| Official PS Remote Play window discovery | real | Media Host, Win32 top-level-window inventory | source selector next |
| Windows Graphics Capture frame acquisition | fault-injected-real | Media Host captured a labeled mock window | prove official client next |
| Capture start/status/stop UI | fault-injected-real | Packaged Electron controls and native telemetry | retain |
| Official PS Remote Play window source | unavailable | none | Gate 1 |
| PS Remote Play process audio | unavailable | none | Gate 2 |
| Twitch Window Source | unavailable | none | Gate 1 |
| Remote-source sync delay | unavailable | none | Gate 2 |
| Camera/mic encoded file | real | DirectShow bounded proof | proof only |
| Display-to-MP4 process | real | Separate ScreenRecorder adapter | proof only |
| Encoder selection logic | real | Helper tests only | proof only |
| RTMPS URL/tee logic | real | Engine code; IPC disabled | unavailable to product |
| Audio route controls | simulated | Show state only | replace |
| Foundation destinations | mock | Show state only | replace |
| Program video compositor | unavailable | none | Gate 1 |
| Preview/Program take | unavailable | none | Gate 1 |
| Program recording | unavailable | none | Gate 1/2 |
| Program audio buses | unavailable | none | Gate 2 |
| Show/source/scene CRUD | unavailable | none | Gate 3 |
| Credential vault | unavailable | none | Gate 4 |
| Twitch route | unavailable | none | Gate 4 |
| Facebook route | unavailable | none | Gate 4 |
| Twitch + Facebook fan-out | unavailable | none | Gate 4 |
| PS5/Twitch Console Bridge | unavailable | none | Gate 4 |
| Native PlayStation source | unavailable | none | Gate 6A |
| Independent route recovery | unavailable | none | Gate 4 |
| Renderer-crash continuity | unavailable | none | Gate 5 |

The current machine returned zero matching PS Remote Play windows on
2026-08-03. That is a successful `real` discovery result, not proof of window
capture. A later fault-injected run captured non-zero D3D11 frames from a
labeled mock window, but no official Sony client or PS5 was connected. Process
audio, shared-texture presentation, Program composition, and the official
PlayStation source remain `unavailable`.

## Proof separation

- Local renderer proof does not certify Electron.
- Electron proof does not certify native media.
- Native media proof does not certify packaged media.
- Packaged media proof does not certify a destination.
- Non-production endpoint proof does not certify production live output.
