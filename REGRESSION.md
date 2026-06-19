# Regression

This is the live regression checklist for the TestFlight reviewer-data gate.
It is meant to answer two questions before a release:

1. Did the user-facing flow finish on the phone?
2. Did the corresponding public transaction reach Mutinynet confirmation?

## Current Release Target

- App version: `0.2.0`
- Target build: iOS build `5`
- Network: Mutinynet
- Fixture: submitted TestFlight reviewer wallet
- Command: `npm run e2e:real:no-usdc`
- USDC/Sepolia scope: intentionally excluded until the reviewer Sepolia gas fixture is funded.
- Bypass flags: not used for the live gate.
- Website report: `docs/regression/index.html`
- Website regeneration command: `npm run regression:site`

## Gate Coverage

| Flow | What It Proves | Live Profile |
| --- | --- | --- |
| Receive BTC | Fresh wallet receives faucet BTC and receive-address chain lookup finds a confirmed tx. | `receive-btc` |
| Send BTC | Phone signs and broadcasts a real BTC send. | `send-btc` |
| Send UNIT | Reviewer wallet signs and broadcasts a real on-chain UNIT send with Turbo disabled. | `send-unit` |
| Vault actions | Fresh wallet opens a vault, deposits collateral, borrows UNIT, repays UNIT, and withdraws collateral. | `vault-actions` |
| Borrow TurboUNIT | Reviewer wallet borrows from the vault and settles issued UNIT into TurboUNIT. | `vault-borrow-turbounit` |
| Repay TurboUNIT | Reviewer wallet mints TurboUNIT and repays by selecting the TurboUNIT funding card. | `repay-turbounit` |
| Second repay | Reviewer wallet executes two consecutive UNIT repayments against the same vault. | `vault-second-repay` |
| Send relaunch recovery | BTC and UNIT sends survive app restart and recover pending history. | `send-btc-relaunch-pending`, `send-unit-relaunch-pending` |
| Vault relaunch recovery | Vault open, deposit, borrow, repay, and withdraw survive app restart and clear pending locks. | `vault-*-relaunch-pending` |
| TurboUNIT relaunch recovery | TurboUNIT open, borrow, and repay settlement paths survive app restart and clear pending locks. | `vault-*-turbounit-relaunch-pending` |

## Timing Model

The live runner records:

- Total gate wall-clock time.
- Per-Maestro-flow wall-clock time.
- Every txid discovered from the simulator or clipboard.
- Mutinynet confirmation status, block height, and block time for each txid.
- Active stuck-phase watchdog state for preparing, building, submitting, Turbo mint/melt, and send build/broadcast.

The runner does not yet timestamp every individual Maestro YAML command. Use the per-flow timing table plus tx confirmation table below as the release-facing timing record, and use the JSON artifacts for exact raw data.

## Last Completed No-USDC Gate

Artifacts:

- `artifacts/live-regression/testflight-no-usdc-20260619T001057Z.json`
- `artifacts/live-maestro/testflight-no-usdc-20260619T001057Z.json`

Result: passed.

Total wall-clock: 100m 44s.

Summary:

- 17/17 maintained no-USDC live flows passed.
- 73/73 recorded Mutinynet txids confirmed.
- `activeAtExit`: empty.
- Generated report: `docs/regression/index.html`.

| Flow | Duration | Steps Covered |
| --- | ---: | --- |
| Receive/send | 6m 56s | Receive BTC, send BTC, and send UNIT. |
| Vault actions | 10m 06s | Open, deposit, borrow, repay, and withdraw in one fresh-wallet run. |
| TurboUNIT | 16m 16s | Borrow TurboUNIT, repay TurboUNIT, and second consecutive repay. |
| Send relaunch recovery | 9m 55s | BTC and UNIT pending send recovery after restart. |
| Vault relaunch recovery | 27m 35s | Open, deposit, borrow, repay, and withdraw pending vault recovery after restart. |
| TurboUNIT relaunch recovery | 22m 17s | Open, borrow, and repay TurboUNIT pending recovery after restart. |

## Previous No-USDC Gate

Artifacts:

- `artifacts/live-regression/testflight-no-usdc-2026-05-18.json`
- `artifacts/live-maestro/testflight-no-usdc-2026-05-18.json`
- `artifacts/live-regression/receive-btc-2026-05-18.json`

Result: passed.

| Flow | Duration | Steps Covered |
| --- | ---: | --- |
| Receive BTC | 2m 57s | Create wallet, faucet funds wallet, open receive BTC screen, copy receive address. |
| Send BTC | 2m 31s | Create funded wallet, enter external BTC address, max send, review, broadcast, copy txid. |
| Send UNIT | 2m 36s | Import reviewer wallet, verify vault/UNIT, enter taproot address, disable Turbo, review, broadcast, copy txid. |
| Vault actions | 8m 28s | Create wallet, open vault, wait UNIT balance, deposit BTC, borrow UNIT, repay UNIT, withdraw BTC. |
| Repay TurboUNIT | 5m 43s | Import reviewer wallet, mint TurboUNIT through Cashu, select TurboUNIT funding card, repay. |
| Second repay | 6m 05s | Import reviewer wallet, first UNIT repay, wait vault ready, second UNIT repay. |

Confirmed txids:

| Txid | Evidence | Block |
| --- | --- | ---: |
| `930bc03bfc5e6272c3c679d4f1829bcfab19830821f3bf05cba98dbc2c6e9aff` | Clipboard txid from live send flow. | 3110218 |
| `ce3d2c93932770148c101853c96c574950cd85231af8b90b97c8e98bd8b91b32` | Simulator pending store: BTC send and vault repay. | 3110256 |
| `050fd8dcb6583ee9bbd778edad331bb2b13814d0b5845eda2e18ef922296c3a3` | Simulator pending store: UNIT send and vault repay. | 3110256 |
| `ce9adaa9360be8059593f98b8a063fd97940c540a159ba7d933102debdbdbcc0` | Simulator pending store: UNIT send confirmed during vault repay recovery. | 3110249 |
| `d105c5398d4b2e00fee95f86fcd2065b5961fe7b6622b8680597b28bceede0bc` | Simulator pending store: BTC send confirmed during vault repay recovery. | 3110249 |
| `b7c12287743eb7eb04ca4bff215e63db407e542677362ca1cf6e22739d1ff003` | Standalone receive-address chain lookup. | 3110263 |

## Release Rule

For build `0.2.0 (5)` or any later build-number bump, rerun `npm run e2e:real:no-usdc` before submission. Only submit the EAS production build if:

- The live gate exits `0`.
- The live regression report result is `passed`.
- Every recorded Mutinynet txid has `confirmed: true`.
- `activeAtExit` is empty.
- No Metro process is left listening on `8082`.
