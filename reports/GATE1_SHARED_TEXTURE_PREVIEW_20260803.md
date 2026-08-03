# Gate 1 Shared-Texture Source Preview Proof

Date: 2026-08-03  
Result: PASS  
Classification: `fault-injected-real`

## What this proves

PulseCast Media Host 0.3.0 acquired non-zero Windows Graphics Capture frames
from a deliberately labeled mock `PS Remote Play` window, copied those frames
into a keyed D3D11 NT-handle shared texture, reopened the texture on a second
D3D11 device, and presented the pixels through a native child HWND parented to
the packaged Electron application.

The packaged UI visibly presented the live source in both Settings and the
Production source monitor. Opening Diagnostics detached the native surface so
it could not cover the safety drawer; closing Diagnostics reattached it.
Stopping capture removed the surface and retained last-capture telemetry.

## Proof boundary

| Capability | Proof | Evidence |
|---|---|---|
| WGC/D3D11 frame acquisition | fault-injected-real | non-zero frame count from labeled mock window |
| Keyed shared-texture publication | fault-injected-real | native producer/consumer contract and non-null shared handle |
| Second-device texture reopen | fault-injected-real | proof harness requires presented frames on consumer device |
| Settings native source monitor | fault-injected-real | packaged screenshot |
| Production native source monitor | fault-injected-real | packaged screenshot |
| Diagnostics detach/reattach | fault-injected-real | packaged screenshots and interaction run |
| Stop cleanup | fault-injected-real | packaged stopped/detached screenshot |
| Official Sony Remote Play client | unavailable | client was not running |
| Connected PS5 source | unavailable | no PS5 was connected |
| Remote Play process audio | unavailable | Gate 2 |
| Program compositor | unavailable | this surface is only a source monitor |
| Twitch/Facebook routing | unavailable | Gate 4 |

## Commands and results

```powershell
npm.cmd run verify
npm.cmd run native:capture-proof
npm.cmd run package:win
npm.cmd run smoke:packaged
```

- TypeScript/Electron: 35 tests passed in 4 files.
- Native: build and CTest passed.
- Native proof: capture and preview both reached active state with non-zero
  acquired and presented frame counts.
- Package: `release-reboot/build-20260803-135451/win-unpacked/PulseCast Studio.exe`
- Packaged app SHA-256:
  `DDAE2139496A45D5959A10FC7F4B4F1A4C259870761C5E1EB01CCCA866C34EB3`
- Packaged Media Host SHA-256:
  `1499CEA9307F2B6F07E0E8E44DCC8496EBDD6103C18033F7C15982C3DE6AE6D0`

## UI evidence

See `reports/ui-proof/20260803-134100-shared-texture-preview/`.

## Next promotion gate

Repeat this exact capture and presentation proof with the official Sony Remote
Play client connected to an authorized PS5. After that, bind the source into a
native D3D11 Program compositor with camera layering; do not treat this source
monitor as Program.
