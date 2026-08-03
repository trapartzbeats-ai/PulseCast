# Implementation Parity

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Native Settings preview | child HWND attached to measured Settings bounds | `settings-embedded-preview.png` | PASS |
| Native Production source monitor | same reusable preview component attached to canvas bounds | `production-source-preview.png` | PASS |
| Presented-frame truth | UI count follows native preview telemetry | Settings and Production screenshots | PASS |
| Diagnostics safety | preview disabled and detached while drawer is open | `diagnostics-preview-blocked.png` | PASS |
| Reattach | closing drawer recreates active native presentation | interaction review | PASS |
| Stop cleanup | native surface removed; last capture retained | `stopped-detached.png` | PASS |
| Program boundary | source monitor is explicitly labeled and not routed | all screenshots | PASS |

This parity record covers only the `fault-injected-real` source-preview slice.
It does not promote the official PlayStation source or Program composition.
