# Packaged Windows Build

## Build

```powershell
cd D:\Projects\PulseCast
npm.cmd install --install-links
npm.cmd run verify
npm.cmd run package:win
npm.cmd run smoke:packaged
```

The package produces an NSIS installer, portable executable, and unpacked
directory beneath an immutable `release-reboot/build-*` folder using the
product name `PulseCast Studio`. `release-reboot/latest.json` points at the
current build so packaging never has to overwrite a locked Electron directory.
Packaging first compiles and tests the native Media Host and places it at
`resources/media-host/PulseCastMediaHost.exe`.

## Runtime variables

| Variable | Purpose | Required |
|---|---|---|
| `PULSECAST_SCREENRECORDER_PATH` | Override bounded recorder proof adapter | No |
| `PULSECAST_DATA_DIR` | Isolate Show/recovery data for smoke tests | No |
| `PULSECAST_DEV_URL` | Load Vite renderer | Development only |

No variable may contain a stream key or OAuth token.

## Packaged smoke boundary

The smoke script verifies the actual unpacked executable, a visible application
window, working Show/checkpoint creation, clean close, and lock removal. The
2026-08-03 Gate 1 package additionally proved that the embedded Media Host can
run its real discovery probe, is supervised by Electron, and can capture real
D3D11 frames from a labeled mock Remote Play window. That capture proof is
`fault-injected-real`. It does not prove the official Sony Remote Play client,
a connected PS5, shared-texture presentation, process audio, Program media,
recording, destination routing, installer behavior, or a production stream.

Installer, portable, upgrade, uninstall, media, and routing proof remain
separate release gates.
