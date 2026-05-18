# serve-sim Regression Methodology

`serve-sim` is the repeatable simulator control plane. Maestro still performs the
deterministic taps/assertions; `serve-sim` keeps the actual simulator visible and
controllable, and the regression runners write machine-readable proof.

## One Command

```bash
npm run test:user-facing:serve-sim -- real --device "iPhone 16 Pro - Maestro" --build
```

This command:

1. Starts `serve-sim` for the selected simulator.
2. Writes the preview URL to `artifacts/serve-sim-regression/last-run.json`.
3. Optionally rebuilds and installs the normal dev client.
4. Runs the selected `e2e/user-facing-regression.json` profile.
5. Captures start/end simulator screenshots.

Use `--no-run` when you only need a live simulator preview:

```bash
npm run test:user-facing:serve-sim -- --no-run --device "iPhone 16 Pro - Maestro"
```

The preview defaults to:

```text
http://127.0.0.1:3201
```

## Test Layers

The app is tested in four layers, and each layer has a different job:

- `pr`: fast static and unit checks. No simulator, no funds.
- `device`: deterministic simulator Maestro flows against the normal installed app UI.
- `live`: real Guardian/Cashu/Mutinynet/Sepolia flows with phase watchdogs.
- `real`: strict live suite with actual app actions, emitted txids/hashes, Mutinynet
  confirmation, and Sepolia receipt verification.

`serve-sim` wraps the `device`, `live`, `real`, or `release` profiles so failures are
visible and reproducible from the same simulator state.

## Pass Contract

A user-facing transaction flow is not considered covered unless all required proof
exists:

- Maestro reaches the expected UI state.
- App logs do not leave a watched phase stuck past its timeout.
- On-chain flows emit `[E2E_TX]` breadcrumbs with public txids.
- Strict real runs verify each Mutinynet txid through Esplora and wait for confirmation.
- The wrapper writes JSON reports and simulator screenshots.

The reports to inspect first are:

```text
artifacts/serve-sim-regression/last-run.json
artifacts/user-facing-regression/last-run.json
artifacts/live-regression/last-run.json
artifacts/live-maestro/last-run.json
```

## Debug Loop

For any failing app action:

1. Re-run only the smallest failing profile through `serve-sim`.
2. Inspect the simulator preview and the JSON reports.
3. Patch the app, flow, or harness contract.
4. Re-run the failing profile.
5. Run `npm run test:user-facing:pr`.
6. For transaction changes, run the matching strict `real-*` suite before release.

No manual phone result counts as a pass unless the corresponding automated report
also passes.
