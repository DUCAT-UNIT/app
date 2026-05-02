# Global App Hardening Plan

This app must remain a Mutinynet app. Sepolia support is limited to EVM-side USDC, wUNIT, bridge, redemption, and gas flows. Sepolia must never become the app network, and remote config must not control network selection.

## Current Baseline

- Mutinynet network invariant is enforced through local config validation and tests.
- Remote config code paths have been removed from the active app surface.
- Sepolia ETH, USDC, wUNIT, bridge, swap, redeem, and dashboard surfaces exist.
- UNIT/USDC pool dashboard exists in Swap Diagnostics with reserves, quote samples, readiness, balances, allowances, and recent state.
- `npm run doctor:live` now gates funded live Mutinynet/Sepolia runs before `npm run e2e:live`.
- Vault settlement state persists bridge client request IDs, bridge intent IDs, and redemption identifiers with startup/diagnostics reconciliation and stale-state cleanup.
- Sepolia redemption preserves confirmed burn/release details even when backend tracking fails.
- Sepolia approval, swap, redemption, and transfer tx hashes are checkpointed before confirmation waits and surfaced in Swap Diagnostics and product screens.
- Submitted or ambiguous failed Sepolia transaction checkpoints are reconciled on startup and refresh EVM balances/history when recovered.
- Confirmed redemption burns can recover bridge API release tracking from persisted checkpoints.
- Sepolia swap, redeem, and send screens show explicit missing-config states instead of failing silently in empty environments.
- Maintained Maestro product coverage is at 67 flows, including Sepolia USDC send validation and redemption source-toggle coverage.
- Turbo processing and P2PK send recovery reject malformed persisted state and retain created tokens across recovery crashes.
- Full repository verify has passed recently, but this document is not complete until every gate below is automated in CI.

## 10/10 Acceptance Gates

- `npm run verify` passes in a clean checkout with no local secrets.
- E2E validation covers every maintained product flow and rejects stale helper-only flows.
- Critical money paths have deterministic unit tests for success, failure, retry, timeout, insufficient funds, and stale quote cases.
- Every transaction-producing screen shows explicit preflight state before signing.
- Every async transaction path is idempotent or recoverable after app restart.
- Logs, analytics, and diagnostics never expose seeds, private keys, PSBTs, raw proofs, or bearer-like secrets.
- Empty environment setup gives actionable errors instead of silent disabled states.
- Architecture boundaries are documented and enforced by tests or lint rules.

## Missing Work By Area

### 1. Network Invariants

- Keep `EXPO_PUBLIC_APP_NETWORK` restricted to Mutinynet values only.
- Add tests proving Sepolia can only be used through EVM bridge services.
- Add deeper tests proving Sepolia can never become the app network through config drift.

### 2. Sepolia Execution Hardening

- Finish service-owned preflights for every Sepolia transaction path.
- Extend stale quote protection into any future bridge API min-out fields once supported server-side.
- Expand retry classification coverage as new provider-specific Sepolia errors are observed.
- Add funded live coverage for successful USDC send, wUNIT send, swap, and redemption completion.
- Add screen-specific retry execution actions once backend idempotency guarantees are formalized for every Sepolia path.

### 3. UNIT/USDC Pool And Swap Dashboarding

- Keep pool dashboard in Swap Diagnostics as the operational source of truth.
- Add richer operator runbooks for interpreting pool reserve drift and quote impact.
- Add deeper E2E coverage for dashboard timeout and copy interactions.

### 4. E2E Coverage

- Add Maestro coverage for swap summary preflight failure states.
- Add Maestro coverage for redeem required source amount and disabled submit states.
- Add Maestro coverage for Sepolia insufficient ETH and funded ERC-20 send completion.
- Add lifecycle E2E for backgrounding during transaction preparation and returning to a recoverable state.
- Add deep link coverage for Turbo/Cashu tokens and address QR handling.

### 5. Critical Unit Coverage

- Increase coverage around vault settlement hooks and stores.
- Cover liquidation swap finalization and failure classification.
- Cover remaining bridge API timeout, malformed response, and retry-classification edge cases.
- Cover EVM history parsing for sent, received, and net-zero transfer groups.
- Cover transaction execution context failure paths and post-auth cancellation.

### 6. Architecture

- Reduce provider nesting and isolate side effects behind service boundaries.
- Move transaction preflight and execution state machines out of screens.
- Document ownership boundaries for wallet state, vault state, Cashu state, EVM bridge state, and diagnostics state.
- Add invariant tests for store reset, wallet deletion, account switching, and app relaunch.
- Remove stale abstractions and dead exports instead of keeping compatibility shells.

### 7. Reliability And Recovery

- Persist in-flight transaction checkpoints before network calls.
- Expand confirmed-burn release tracking recovery into operator runbooks and live E2E coverage.
- Standardize retry and timeout policy across bridge API, RPC, mempool, Ord, and mint calls.
- Add more user-facing retry actions that are safe to tap multiple times.
- Add error boundaries around wallet, vault, Cashu, and developer diagnostics stacks.

### 8. Security

- Re-audit seed, private key, PSBT, proof, and PIN handling.
- Add log redaction tests for known sensitive shapes.
- Ensure E2E bypasses and dev-only controls cannot ship enabled by default.
- Extend storage sensitivity docs as new persisted stores are added.
- Run dependency audit and pin or replace risky packages.

### 9. Performance

- Profile app startup and first wallet render.
- Deduplicate polling across wallet balances, history, vaults, EVM balances, and diagnostics.
- Memoize expensive derived balance and vault calculations.
- Audit provider rerenders and large list rendering.
- Track bundle size and remove unused assets/code paths.

### 10. Empty Environment Readiness

- Expand live readiness from diagnostics into CI/operator runbooks where appropriate.
- Add deterministic fixture mode for local E2E without live funds.
- Add deterministic assertions for missing RPC/backend/token config cards.
- Document exact commands for clean install, verify, E2E validate, and simulator run.
- Ensure the app can be handed to a new agent in an empty env and produce a complete readiness report.

## Execution Order

1. Finish Sepolia execution hardening and tests.
2. Close E2E gaps for Sepolia and liquidation.
3. Raise low-coverage critical services and hooks.
4. Move screen-owned transaction state into services/stores.
5. Add recovery checkpoints and startup reconciliation.
6. Run security, performance, and empty-env hardening passes.
7. Run full verify and update this plan with remaining deltas.
