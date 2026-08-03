# Gate 1 Media Host Discovery Proof

Date: 2026-08-03  
Product: PulseCast Studio 0.3.0-reboot  
Promotion: first Gate 1 vertical slice only

## Outcome

PulseCast now builds, supervises, and packages a C++20 native process named
`PulseCastMediaHost.exe`. Electron communicates with it over a versioned JSONL
request/response contract. Its first production-bound capability is a real
Win32 inventory of top-level windows narrowed to official PS Remote Play
candidates.

The proof machine had no matching PS Remote Play window running. The returned
candidate count was zero and the UI displayed that fact. This verifies the
discovery path and empty state; it does not verify capture from a PS5.

## Proof classification

| Capability | Classification | Evidence |
|---|---|---|
| Native Media Host build | real | MSVC C++20 Release executable |
| JSONL supervisor contract | real | request, response, probe, shutdown sequence |
| PS Remote Play window discovery | real | Win32 `EnumWindows`, zero candidates on proof machine |
| PS Remote Play window capture | unavailable | explicitly reported by native probe and UI |
| PS Remote Play process audio | unavailable | explicitly reported by native probe and UI |
| Program composition | unavailable | explicitly reported by native probe |
| Packaged Media Host | real | executable present and runnable inside unpacked package |
| Live PS5 input | unavailable | PS Remote Play was not connected for this proof |

## Verification

- `npm.cmd run verify`: pass
- ESLint and Prettier: pass
- TypeScript renderer/main checks: pass
- Vitest: 33 tests in 4 files, pass
- Media Host CTest: 1 test, pass
- Media Host one-shot probe: pass
- Media Host supervised serve contract: pass
- Renderer and Electron main production builds: pass
- `npm.cmd run package:win:dir`: pass
- `npm.cmd run smoke:packaged`: pass
- Packaged Media Host `--probe-json`: pass

Packaged artifact used for proof:

`release-reboot/build-20260803-120509/win-unpacked/PulseCast Studio.exe`

Embedded native host:

`release-reboot/build-20260803-120509/win-unpacked/resources/media-host/PulseCastMediaHost.exe`

UI evidence:

`reports/ui-proof/20260803-121500-media-host-discovery/`

## Next acceptance slice

Bind a selected Remote Play `HWND` to Windows Graphics Capture, publish frames
through the Media Host contract without JSON pixel transport, and show a live
source preview. Capture, resize, minimize, disconnect, and recovery behavior
must remain separate acceptance cases.
