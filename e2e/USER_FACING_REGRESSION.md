# User-Facing Regression System

The app is too large and too stateful for scattered Jest tests and ad-hoc Maestro
flows to give enough confidence. The source of truth is now:

```text
e2e/user-facing-regression.json
```

Every critical user-facing flow must be listed there with one of these states:

- covered by a PR-safe suite
- covered by a deterministic device/simulator suite
- covered by a live network suite with log watchdogs
- explicitly marked as a known gap with the missing fixture/harness named

## Commands

```bash
npm run test:user-facing:inventory
npm run test:user-facing:pr
npm run test:user-facing:device
npm run test:user-facing:live
npm run test:user-facing:real
npm run test:user-facing:real-no-usdc
npm run test:user-facing:serve-sim
npm run test:user-facing:release
```

`test:user-facing:pr` runs fast local/CI checks: quality gates, Maestro flow
validation, and focused transaction-state tests.

`test:user-facing:device` runs deterministic Maestro flows against an installed
development build.

`test:user-facing:live` runs real Mutinynet/Sepolia/Cashu/Guardian flows through
`scripts/runLiveRegression.mjs`, including phase watchdogs for preparing,
building, submitting, TurboUNIT melt, released UNIT detection, and preferred UTXO
selection.

`test:user-facing:real` runs the strict live phone suite with real receive,
BTC/UNIT sends, all vault actions, consecutive second repay, TurboUNIT repay,
USDC settlement, liquidation claim/swap, Cashu/Turbo deep-link recovery,
Sepolia send/swap/redeem, emitted txid/hash capture, Mutinynet confirmation
checks, and Sepolia receipt checks.

`test:user-facing:real-no-usdc` runs the strict live phone suite backed by the
submitted TestFlight reviewer data, excluding Sepolia/USDC flows and other
fixture-gated extras that need fresh external data. It includes both TurboUNIT
directions: borrow settled to TurboUNIT and repay funded by TurboUNIT, plus a
non-destructive liquidation validator feed check against the app's live feed
endpoint.

`test:user-facing:serve-sim` starts a `serve-sim` preview/control plane for the
selected simulator, then runs the selected user-facing profile and captures
simulator screenshots. By default it runs the strict `real` profile.

`test:user-facing:release` runs all of the above, including the strict real suite,
and is the release gate for transaction-affecting changes.

Reports are written to:

```text
artifacts/user-facing-regression/last-run.json
artifacts/live-regression/last-run.json
artifacts/serve-sim-regression/last-run.json
```

## Rule For New Risk

When a change touches a user-facing critical flow, update
`e2e/user-facing-regression.json` in the same change:

- add or update the suite that covers the risk, or
- mark a gap explicitly with the fixture/harness needed to close it.

Do not treat unit coverage alone as enough for transaction flows that depend on
the real phone app, Guardian, Cashu mint, bridge, or chain indexers.

The manifest should pass strict completeness validation before release:

```bash
node scripts/runUserFacingRegression.mjs --validate --enforce-complete
```
