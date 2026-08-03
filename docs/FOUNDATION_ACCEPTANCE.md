# Retained Foundation Acceptance Boundary

This document describes the retained Foundation slice only. Product promotion
is governed by `PULSECAST_MASTER_BLUEPRINT.md` and
`docs/CAPABILITY_LEDGER.md`.

| Capability | Proof type | Current status |
|---|---|---|
| Show commands and revisions | real | Unit tested |
| JSON projection and journal | real | Unit tested |
| Checkpoint and recovery | real | Unit tested |
| Checksummed `.pcast` export | real | Unit tested |
| Pulse renderer lifecycle | real | Renderer integration |
| Browser camera/mic preview | real | Preview only; not Program |
| Browser display preview | real | Preview only; not Program |
| Camera/mic encoded proof | real | Bounded diagnostic |
| Display-to-MP4 adapter | real | Bounded diagnostic |
| Audio route controls | simulated | No real sample binding |
| Foundation destination tray | mock | No transport binding |
| One-source Program-video compositor | fault-injected-real | Native 1920 × 1080 transform proof; not a full scene |
| Multi-source Program compositor | unavailable | Gate 1 |
| Program audio graph | unavailable | Gate 2 |
| Twitch/Facebook routing | unavailable | Gate 4 |
| Credential vault | unavailable | Gate 4 |
| Broadcast continuity | unavailable | Gate 5 |

No Foundation control, mock, simulated meter, browser preview, adjacent binary,
or bounded proof may satisfy a Program recording or live-output gate.
