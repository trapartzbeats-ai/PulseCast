# Implementation Parity

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| 1920 × 1080 native output | D3D11 render-target texture | Settings telemetry and Production pixels | PASS |
| Native transform | x/y/width/height contract and controls | Settings controls; native proof uses 240,135 / 1440 × 810 | PASS |
| Composed-frame truth | native counter independently validated | Settings and Production labels | PASS |
| Canvas containment | bounded grid row with overflow clipping | `production-contained-program-output.png` | PASS AFTER REVISION |
| Product boundary | `PROGRAM VIDEO TEST OUTPUT` and warning copy | both packaged screenshots | PASS |

This parity record does not certify a multi-source Program, official Sony
Remote Play, recording, audio, or live output.
