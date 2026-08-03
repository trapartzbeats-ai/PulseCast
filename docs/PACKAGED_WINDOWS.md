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

## Runtime variables

| Variable | Purpose | Required |
|---|---|---|
| `PULSECAST_SCREENRECORDER_PATH` | Override bounded recorder proof adapter | No |
| `PULSECAST_DATA_DIR` | Isolate Show/recovery data for smoke tests | No |
| `PULSECAST_DEV_URL` | Load Vite renderer | Development only |

No variable may contain a stream key or OAuth token.

## Packaged smoke boundary

The smoke script verifies the actual unpacked executable, a visible application
window, working Show/checkpoint creation, clean close, and lock removal. It does
not prove Program media, recording, destination routing, installer behavior,
or a production stream.

Installer, portable, upgrade, uninstall, media, and routing proof remain
separate release gates.
