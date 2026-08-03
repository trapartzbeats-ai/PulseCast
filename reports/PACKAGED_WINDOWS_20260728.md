# PulseCast packaged Windows proof

Status: **PASS**

## Deliverables

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `release/PulseCast-Studio-Foundation-Setup-0.1.0-foundation-x64.exe` | 98,954,685 | `ED3B0D08B600502A3E288E714E185D99F9FB34C037D79A4C5A83EAFDE876E9C1` |
| `release/PulseCast-Studio-Foundation-Portable-0.1.0-foundation-x64.exe` | 98,724,590 | `81323A5D61284A7A45C791D17B95C7A08A1F2749767915C1D846269B11721BD5` |
| `release/win-unpacked/PulseCast Studio Foundation.exe` | 210,832,896 | `E536763CE0108112CA1317371AF572DEDF9B5DA7D3D6A1822163FF1BAE9EE7BF` |

All artifacts report product version `0.1.0-foundation`. They are unsigned.

## Source and native gates

- `npm.cmd run verify`: PASS
- TypeScript typecheck: PASS
- Vitest: PASS, 6 of 6
- Vite production build: PASS
- Electron main/preload build: PASS
- Adjacent adapter probe: PASS, 4 of 4 present
- `npm.cmd run native:verify`: PASS
- CTest: PASS, 1 of 1

## Packaged-runtime gates

### Unpacked executable

- opened a real `PulseCast Studio - Foundation` window: PASS
- created working Show state: PASS
- created checkpoint: PASS
- normal close within ten seconds: PASS
- recovery session lock removed: PASS

### Portable executable

- portable launcher and five-process tree started: PASS
- opened the real application window: PASS
- created working Show and checkpoint state: PASS
- normal close within fifteen seconds: PASS
- recovery session lock removed: PASS

### Installer

- silent per-user install into an isolated test directory: PASS
- installed executable launched a real window: PASS
- persisted working Show state: PASS
- clean shutdown and session-lock cleanup: PASS
- silent uninstaller exit: PASS
- installed executable removed: PASS

The isolated installer test was uninstalled after verification.

## Package-content gate

The packaged ASAR contains the renderer, compiled Electron main process, and
runtime dependencies. It contains no project `src`, `tests`, `reports`, `docs`,
native-source tree, master blueprint, project source maps, or environment file.

## Boundaries

This is packaged Foundation proof, not live-stream proof. Camera/audio remain
simulated; platform destinations remain mock; stream credentials and RTMPS are
unavailable. No supplied platform keys were embedded in any artifact.
