# E2E Test Coverage Report

## Current State: 67 Maintained Product Flows, ~72% Functional E2E Coverage

The maintained Maestro suite now covers all primary product areas: auth, wallet, send, settings, vault, ecash, gated Sepolia bridge surfaces, the UNIT/USDC pool unlock path, and shallow liquidation dashboard access. Long-running Sepolia/reviewer flows live separately under `flows/test` and should not be part of the default product suite.

## Maintained Flow Inventory

| Suite | Flow Count | Coverage Level | Notes |
|---|---:|---:|---|
| Auth | 8 | ~80% | Create/import, PIN unlock, wrong PIN, lockout, delete/recreate, auto-lock. Passkey restore and real biometric device behavior remain manual/device-only. |
| Wallet | 19 | ~76% | Receive BTC/UNIT, funded balance, history, BTC/UNIT asset detail, pull refresh, transaction detail, QR scanner, Sepolia bridge nav, Sepolia ETH receive/send surfaces, Sepolia USDC send validation, Sepolia validation errors, liquidation dashboard. |
| Send | 9 | ~70% | BTC/UNIT completion, invalid address, review back, max BTC/UNIT, insufficient funds, taproot address, Turbo choice fallback. |
| Settings | 17 | ~84% | Preferences, security, PIN change, lock, cashu settings, advanced, Enable USDC developer gate, legal screens, account switcher, notifications, delete wallet. |
| Vault | 9 | ~70% | Create/deposit/borrow/repay/withdraw, full lifecycle, max borrow/repay, insufficient-fee guard. Live timing remains the main risk. |
| Ecash | 5 | ~45% | Low-balance modal, mint navigation, receive-token screen, mint screen, mint initiation. Full token lifecycle and melt completion are not fully automated. |
| Sepolia/Bridge | Product suite partial + live flows | ~45% | Developer unlock, ETH and USDC asset send validation, swap/redeem entry, redeem destination validation, and live vault USDC settlement flows exist. Direct Sepolia send/swap/redeem completion coverage still needs funded live environments. |
| Liquidation | Dashboard/state only | ~20% | UI entry and dashboard state exist; full liquidation claim execution is still not E2E-covered. |

## Suite Hygiene

- `npm run e2e` runs `e2e/maestro/run-all-sequential.sh`, which executes only maintained product suites: `auth`, `wallet`, `send`, `settings`, `vault`, `ecash`.
- `e2e/maestro/flows/config.yaml` intentionally excludes `helpers` and `test` so ad-hoc/live flows are not accidentally pulled into standard runs.
- `npm run e2e:live` first runs `npm run doctor:live`, then runs long-running or environment-specific flows under `e2e/maestro/flows/test`.
- `npm run e2e:smoke` references existing flows only.
- `npm run e2e:validate` fails on stale package flow references, broken `runFlow` helper references, duplicate suite numbering, legacy YAML helper drift, and coverage-count mismatches.

## Highest Remaining E2E Gaps

1. Sepolia funded live flows:
   - Native ETH send success and insufficient-gas failure.
   - USDC send success.
   - wUNIT send success.
   - Swap quote -> summary -> approval -> execution with seeded USDC and ETH.
   - Redemption estimate -> approval/burn -> release polling with seeded wUNIT/USDC and a funded Mutinynet destination.
   - Bridge API outage and malformed-response recovery in a simulator-controlled environment.

2. Cashu/Turbo completion:
   - Cashu token send generation.
   - Cashu receive paste/scan with a real token.
   - Melt completion from ecash back to UNIT.
   - Turbo token claim from deep link.
   - Mint recovery after app restart.

3. Liquidation:
   - Empty state with no available vaults.
   - Available-vault list and amount selection.
   - Review tabs.
   - Claim execution success/failure.

4. Deep links and background behavior:
   - Bitcoin URI deep link.
   - Cashu token deep link.
   - Invalid QR/deep-link error handling.
   - Background task state restoration.

5. Error/recovery paths:
   - Network/API failure banners.
   - Transaction broadcast failure modal.
   - ErrorBoundary fallback and recovery.
   - Unconfirmed UTXO warnings.

## Practical Score

- Maintained E2E coverage: 73/100.
- High-confidence deterministic E2E coverage: 67/100.
- Live-network critical-path coverage: 48/100.

The suite is useful and honest, but the app is not at 10/10 E2E confidence until the remaining live Sepolia, Cashu/Turbo completion, liquidation execution, and deep-link/error paths are automated in stable environments.
