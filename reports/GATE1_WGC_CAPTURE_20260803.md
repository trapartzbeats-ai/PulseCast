# Gate 1 Windows Graphics Capture Proof

Date: 2026-08-03  
Product: PulseCast Studio 0.3.0-reboot  
Media Host: 0.2.0  
Promotion: capture acquisition and control slice only

## Outcome

`PulseCastMediaHost.exe` now creates a pickerless Windows Graphics Capture
session for a selected discovered window, receives native D3D11 frames, and
reports capture lifecycle, monotonic frame timing, frame count, dimensions,
source identity, stall state, and errors through its versioned process
contract.

The packaged Electron application exposes candidate selection and capture
start/stop controls. It displays `CAPTURE REAL` only after `frameCount > 0` and
displays `STOPPED` plus explicitly labeled last-capture telemetry after stop.

## Proof classification

| Capability | Classification | Evidence |
|---|---|---|
| WGC/D3D11 capture implementation | fault-injected-real | real native frames from a labeled mock window |
| Native start/status/stop contract | fault-injected-real | supervised JSONL requests and responses |
| Packaged Electron control binding | fault-injected-real | packaged UI reached active and stopped states |
| Frame count and resolution telemetry | fault-injected-real | non-zero frames at 962 x 572 |
| Official Sony Remote Play capture | unavailable | official client and PS5 were not connected |
| Shared-texture renderer presentation | unavailable | no production frame surface is presented in Electron |
| Remote Play process audio | unavailable | Gate 2 |
| Program composition | unavailable | compositor not implemented |

The fixture process was `powershell.exe`, titled `PS Remote Play`, and visibly
labeled `MOCK REMOTE PLAY WINDOW - REAL WINDOWS CAPTURE`. It cannot satisfy the
official PlayStation-source acceptance gate.

## Verification

- `npm.cmd run verify`: pass
- Vitest: 34 tests in 4 files, pass
- Media Host CTest: pass
- `npm.cmd run native:capture-proof`: pass, `fault-injected-real`
- Native capture response: `state=active`, `frameCount > 0`, 962 x 572
- `npm.cmd run package:win:dir`: pass
- packaged start/active/stop UI flow: pass
- packaged smoke: pass

Final package used for UI proof:

`release-reboot/build-20260803-122625/win-unpacked/PulseCast Studio.exe`

UI evidence:

`reports/ui-proof/20260803-122500-wgc-capture/`

## Next acceptance slice

Publish the acquired D3D11 texture through a versioned shared-texture
descriptor and present it in the PulseCast source preview without transporting
raw pixels through JSON IPC or browser MediaStreams. Then repeat the proof with
the official Sony Remote Play client connected to an authorized PS5.
