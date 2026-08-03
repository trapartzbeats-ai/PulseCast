# Gate 1 One-Source Program Compositor Proof

Date: 2026-08-03  
Result: PASS  
Classification: `fault-injected-real`

## What this proves

PulseCast Media Host 0.4.0 accepts real Windows Graphics Capture textures,
copies them into a shader-readable native texture, draws them through an
explicit position/size transform into a 1920 × 1080 D3D11 render target, and
publishes the composed texture through the existing keyed shared-texture
presentation path.

The transform proof used `x=240`, `y=135`, `width=1440`, and `height=810`.
The proof harness required non-zero captured, composed, and presented frame
counts and required the reported output to remain exactly 1920 × 1080.

The packaged Studio exposes source-transform controls and separate captured,
composed, and presented counters. Visual review found and then corrected a
native-child containment defect; final build `build-20260803-153547` keeps the
native output completely inside the Production canvas.

## Proof boundary

| Capability | Proof | Evidence |
|---|---|---|
| WGC source acquisition | fault-injected-real | labeled mock Remote Play window |
| D3D11 shader compositor | fault-injected-real | non-zero composed frames |
| 1920 × 1080 Program-video texture | fault-injected-real | native contract and packaged output |
| Position/size transform command | fault-injected-real | 240,135 / 1440 × 810 proof assertion |
| Keyed shared-texture presentation | fault-injected-real | non-zero presented frames |
| Packaged Settings controls | fault-injected-real | packaged screenshot |
| Packaged Production containment | fault-injected-real | packaged screenshot after revision |
| Official Sony Remote Play client | unavailable | client was not running |
| Connected PS5 source | unavailable | no PS5 was connected |
| Camera/graphic layering | unavailable | compositor currently has one native source |
| Preview/Program separation | unavailable | one monitor surface only |
| Program recording | unavailable | no encoder/recorder consumes composed frames |
| Program audio and routing | unavailable | later gates |

## Verification

```powershell
npm.cmd run verify
npm.cmd run native:capture-proof
npm.cmd run package:win:dir
npm.cmd run smoke:packaged
```

- TypeScript/Electron: 37 tests passed in 4 files.
- Native: build and CTest passed.
- GPU proof: captured, composed, and presented counts all reached non-zero.
- Package: `release-reboot/build-20260803-153547/win-unpacked/PulseCast Studio.exe`
- Packaged app SHA-256:
  `D9C2F7CEBEC8832871D7EE1D2AEAD8B1CF6BF457F4A6911DF961B4BC27101492`
- Packaged Media Host SHA-256:
  `0AA1E6B43F6D0CF6ADAB0197DA89E52BBE7373AB2EBA068D15DC90BA7935177F`

## Next promotion gate

Add a second real source, beginning with native camera capture, so z-order and
multi-source transforms can be proven. Then separate Preview from Program and
record the Program texture. The official Sony/PS5 path must be rerun when that
client and console are available.
