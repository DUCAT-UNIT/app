# Live Regression Runs

These runs exercise real Mutinynet/Sepolia/Cashu/Guardian paths. They are slower than
the deterministic Maestro suite and can spend funded test fixtures.

## Commands

```bash
npm run e2e:regression:repay
npm run e2e:regression
npm run e2e:real:no-usdc
npm run e2e:real
npm run e2e:serve-sim
```

`e2e:regression:repay` runs the critical TurboUNIT path:

1. Import the reviewer wallet.
2. Create a real vault through Guardian.
3. Mint live TurboUNIT through the Cashu on-chain UNIT flow.
4. Repay a tiny amount by selecting the TurboUNIT funding card.

`e2e:regression` runs the TurboUNIT repay path, the live USDC vault lifecycle,
and the consecutive second-repay regression.

`e2e:real` is the strict live E2E gate. It drives the phone through real receive,
BTC send, UNIT send, vault open/deposit/borrow/repay/withdraw, consecutive
repay, TurboUNIT repay, USDC settlement, liquidation execution, token deep-link
recovery, and Sepolia send/swap/redeem flows. It requires emitted Mutinynet txids
to be visible on Esplora, emitted Sepolia hashes to have successful receipts, and
waits for block confirmation when `--require-confirmation` is enabled.

`e2e:real:no-usdc` is the strict live TestFlight reviewer-data gate while USDC is
out of scope. It runs receive BTC, BTC send, UNIT send, vault
open/deposit/borrow/repay/withdraw, borrow settled to TurboUNIT, TurboUNIT
repay, consecutive second repay, and a non-destructive live liquidation feed
check with Mutinynet confirmation checks.

`e2e:serve-sim` wraps the strict real gate with `serve-sim`, leaving a visible
simulator preview and screenshots in `artifacts/serve-sim-regression/`.

Profiles can also be run directly:

```bash
node scripts/runLiveRegression.mjs --require-confirmation receive-btc
node scripts/runLiveRegression.mjs --require-confirmation send-btc
node scripts/runLiveRegression.mjs --require-confirmation send-unit
node scripts/runLiveRegression.mjs --require-confirmation vault-actions
node scripts/runLiveRegression.mjs --require-confirmation vault-borrow-turbounit
node scripts/runLiveRegression.mjs --require-confirmation vault-second-repay
node scripts/runLiveRegression.mjs liquidation-feed
node scripts/runLiveRegression.mjs --require-confirmation liquidation-execution
node scripts/runLiveRegression.mjs deep-link-recovery
node scripts/runLiveRegression.mjs --require-confirmation sepolia-send-swap-redeem
node scripts/runLiveRegression.mjs --require-confirmation testflight-no-usdc
node scripts/runLiveRegression.mjs --require-confirmation real
```

Additional strict-profile prerequisites:

- `DUCAT_LIVE_CASHU_TOKEN_URL=<fresh token link>`
- `DUCAT_LIVE_TURBOUNIT_TOKEN_URL=<fresh token link locked to the reviewer wallet>`

The runner automatically loads the submitted TestFlight `production` profile from
`eas.json`, then layers `.env` and `.env.local` on top. If omitted, it also
defaults the Sepolia recipient to the reviewer wallet, uses tiny Sepolia amounts,
and uses `0.00001` BTC for liquidation invest amount. Funded Mutinynet/Sepolia
fixtures, bridge pool liquidity, and liquidation feed/claim availability are
verified from public chain/API state instead of manual acknowledgement flags.

## Watchdog

The runner wraps `scripts/runMaestroLive.mjs` and watches Metro/app logs for critical
transaction phases:

- vault request preparation
- guardian connection
- vault transaction build
- guardian submit
- TurboUNIT repay quote/melt
- TurboUNIT released UNIT visibility
- preferred TurboUNIT UTXO selection
- send intent preparation
- send signing and broadcast

If a watched phase does not advance before its timeout, the run fails and writes a
report to `artifacts/live-regression/last-run.json`.

## Transaction Proof

The app emits `[E2E_TX]` breadcrumbs for public transaction ids during live runs:

- faucet receive
- Bitcoin/UNIT broadcast
- send confirmation polling
- vault create/deposit/borrow/repay/withdraw success
- vault state application
- TurboUNIT mint/melt readiness
- Cashu/Turbo token link claim completion
- Sepolia send/swap/redeem transaction hashes

`scripts/runLiveRegression.mjs` parses those breadcrumbs and verifies every
Mutinynet txid through Esplora and every Sepolia tx hash through JSON-RPC.
Without `--require-confirmation`, Mutinynet txs must be found in mempool or
chain and Sepolia txs must have a successful receipt. With
`--require-confirmation`, every Mutinynet tx must reach one confirmation and
every Sepolia tx must be mined before the run passes.

The live doctor still gates these runs unless explicitly skipped with:

```bash
DUCAT_LIVE_REGRESSION_SKIP_DOCTOR=1 node scripts/runLiveRegression.mjs repay-turbounit
```
