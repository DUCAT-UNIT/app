# Client SDK Migration Plan

Status date: 2026-06-18

## Goal

Migrate the mobile frontend to the latest `@ducat-unit/client-sdk` against the Dev Mutinynet stack, then prove the migration by passing the live regression workflow from `ducat-regression-site`.

## Dev Mutinynet Endpoints

| Service | URL |
| --- | --- |
| Relay | `https://relay-mutinynet.dev.ducatprotocol.com` |
| Relay WS | `wss://relay-mutinynet.dev.ducatprotocol.com` |
| Oracle / watchtower | `https://oracle-mutinynet.dev.ducatprotocol.com` |
| Tools | `https://tools-mutinynet.dev.ducatprotocol.com` |
| Validator | `https://validator-mutinynet.dev.ducatprotocol.com` |
| Guardian 1 | `https://guardian-1-mutinynet.dev.ducatprotocol.com` |
| Guardian 1 WS | `wss://guardian-1-mutinynet.dev.ducatprotocol.com/ws` |
| Explorer | `https://explorer-mutinynet.dev.ducatprotocol.com` |
| Esplora API | `https://explorer-mutinynet.dev.ducatprotocol.com/api` |

These defaults are centralized in `utils/networkConfig.ts` and exported through `utils/constants.ts`. The app is intentionally Mutinynet-only.

## SDK Target

Current registry latest checked from GitHub Packages: `@ducat-unit/client-sdk@0.25.2`.

Current vendored package: `vendor/ducat-unit-client-sdk/package.json` reports `0.25.2`.

The upgraded SDK exposes `VaultActionAPI` actions for:

| SDK action | Frontend status |
| --- | --- |
| `open` | Active mobile vault flow |
| `borrow` | Active mobile vault flow |
| `deposit` | Active mobile vault flow |
| `repay` | Active mobile vault flow |
| `withdraw` | Active mobile vault flow |
| `repo` | Active liquidation claim flow |
| `close` | SDK-exported only; no current mobile flow found |
| `trim` | SDK-exported only; no current mobile flow found |

## Frontend Migration Shape

The app keeps the existing mobile-facing `VaultWallet` service boundary while the vendored SDK compatibility layer maps those calls onto the latest SDK primitives:

| Mobile call site | Latest SDK path underneath |
| --- | --- |
| `wallet.vault.open.ctx/quote/req` | `VaultActionAPI.open.create_ctx/create_psbts/create_request` |
| `wallet.vault.borrow.ctx/quote/req` | `VaultActionAPI.borrow.create_ctx/create_psbts/create_request` |
| `wallet.vault.deposit.ctx/quote/req` | `VaultActionAPI.deposit.create_ctx/create_psbt/create_request` |
| `wallet.vault.repay.ctx/quote/req` | `VaultActionAPI.repay.create_ctx/create_psbts/create_request` |
| `wallet.vault.withdraw.ctx/req` | `VaultActionAPI.withdraw.create_ctx/create_psbt/create_request` |
| `wallet.vault.repo.ctx/quote/request` | `VaultActionAPI.repo.create_ctx/create_psbt/create_request` |

The mobile signing guard still builds expected unsigned PSBT templates before signing. This is intentional: it preserves the app's transaction safety checks while letting the latest SDK own the vault transaction construction.

## Required Backend Preconditions

Live vault actions require a fresh validator oracle price from:

`https://validator-mutinynet.dev.ducatprotocol.com/api/price/latest`

The guardian rejects vault requests built from prices older than 300 seconds. The app also enforces the same limit through `MAX_QUOTE_AGE_SECONDS`.

The live regression doctor now checks this precondition before launching Maestro. If the validator publisher is stale, the gate fails fast with a backend prerequisite error instead of spending several minutes before vault open fails.

## Current Verification

Passing local/static checks:

```bash
npm run typecheck -- --pretty false
npm test -- services/__tests__/oracleService.test.ts services/vaultWallet/__tests__/walletApi.test.ts services/vault/__tests__/vault.test.ts services/liquidation/__tests__/fetchVaults.test.ts services/liquidation/__tests__/execution.test.ts --runInBand
npm run e2e:validate
npm run test:user-facing:validate
node --check scripts/runLiveRegression.mjs
node --check scripts/liveFixtureChecks.mjs
node --check scripts/liveIntegrationDoctor.mjs
```

Live regression status:

```bash
/Users/lucasrodriguez/.codex/skills/ducat-regression-site/scripts/run-regression-and-open.sh --repo /Users/lucasrodriguez/Desktop/Ducat/mobile-app/app --skip-open --no-confirmation
```

Latest full gate:

- Report: `artifacts/live-regression/testflight-no-usdc-20260619T001057Z.json`
- Result: passed
- Coverage: 17 live flows, including receive/send, vault actions, TurboUNIT borrow/repay, liquidation execution, and pending relaunch recovery flows.
- Generated site: `docs/regression/index.html`

## Completion Criteria

The migration is complete when:

1. `@ducat-unit/client-sdk` remains at the latest available version.
2. Dev Mutinynet URLs match the table above.
3. Open, borrow, deposit, repay, withdraw, and repo/liquidation paths build requests through latest SDK vault action primitives.
4. Static checks and focused vault/liquidation tests pass.
5. The full `ducat-regression-site` live gate passes after the validator oracle publisher is fresh.

## Next Steps

1. Keep `node scripts/liveIntegrationDoctor.mjs` in the release gate so stale validator prices fail before Maestro starts.
2. Rerun the full `testflight-no-usdc` regression workflow before the next release candidate.
3. If a specific vault action regresses, debug it using the generated `artifacts/live-regression/` and `artifacts/live-maestro/` JSON.
