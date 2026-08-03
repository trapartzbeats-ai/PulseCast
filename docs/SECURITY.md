# PulseCast Security Boundary

## Current enforcement

- Electron context isolation is enabled.
- Renderer Node integration is disabled.
- Native paths are selected by the main process.
- Media proof logs redact supplied secrets.
- Product network output is disabled at the Electron IPC boundary.
- The renderer does not expose destination credential fields.

The retained FFmpeg engine can construct RTMPS commands for unit and adapter
work, but it is not an authorized product output path. Raw stream keys must not
be passed to it from the renderer.

## Gate 4 credential contract

- Windows Credential Manager stores Twitch and Facebook secrets.
- Show files store opaque `credentialRef` values only.
- Media Host resolves a reference immediately before connection.
- Secrets never enter renderer state, Show files, logs, journals, exports,
  environment variables, screenshots, diagnostics, or command-line arguments.
- Revocation, expiration, rotation, reconnect, and redaction are tested.
- Twitch and Facebook routes require explicit confirmation and a successful
  safe test or separately logged override.

## Destination routing

Twitch and Facebook routes have independent credentials, lifecycle, health,
and retry policy. Failure of one route cannot terminate the other route or
local recording. Production platform tests require explicit user authorization
and are reported separately from non-production endpoint proof.

## PlayStation source credentials

Remote Play registration keys, account identifiers, PSN OAuth tokens, console
addresses marked private, and wake credentials are secrets. They are stored in
Windows Credential Manager and resolved only by the official-capture adapter
or the isolated PlayStation source process. They never enter Shows, logs,
journals, command lines, screenshots, or diagnostic exports.

## Diagnostics

Diagnostic exports default to privacy mode, redact secrets and private source
names, and include only allowlisted files. Any key shared through chat,
screenshots, issues, or logs must be rotated before use.
