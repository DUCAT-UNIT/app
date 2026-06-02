# Scripts

Helper scripts for the DUCAT wallet project.

## Doctor

Validate local tooling and project invariants before running the heavier quality gate.

```bash
npm run doctor
```

Checks:

- Node 22.x and npm 10+
- `package-lock.json` and installed dependencies
- Required npm quality scripts
- Mutinynet-only app network guards
- Test shortcut config guard
- Removed remote config service/store
- Optional native tools for Maestro, Xcode, and EAS

## Live Integration Doctor

Validate that the machine is ready to run funded Mutinynet/Sepolia Maestro flows.

```bash
npm run doctor:live
npm run e2e:live:turbo
```

This is intentionally stricter than `npm run doctor`. It fails unless:

- `EXPO_PUBLIC_APP_NETWORK` is unset or `mutinynet`
- Sepolia RPC, bridge API, wUNIT, router, UNIT/USDC pool, and USDC config are valid
- Maestro, simulator tooling, and `node_modules` are present
- Sepolia RPC, bridge `/health`, Mutinynet Esplora, and Cashu mint `/v1/info` probes succeed
- The Ducat Cashu mint advertises NUT-04 `onchain/unit` and `onchain/sat`
  support for Turbo UNIT and Turbo BTC flows

Funded fixture checks happen in `scripts/runLiveRegression.mjs` for the selected
profile. The runner derives the reviewer fixture, checks Mutinynet/Sepolia
balances and bridge pool liquidity from public chain state, and fails before
Maestro starts if the selected real flow cannot execute.

For script-only validation without network/tool probes:

```bash
DUCAT_LIVE_DOCTOR_OFFLINE=1 DUCAT_LIVE_DOCTOR_SKIP_TOOLING=1 npm run doctor:live
```

`scripts/runMaestroLive.mjs` writes a redacted run report to
`artifacts/live-maestro/last-run.json` by default. Override with
`MAESTRO_LIVE_REPORT_PATH=<path>`, or set `MAESTRO_LIVE_REPORT_PATH=off` to skip
the artifact. The report records flow names, pass/fail status, duration, the
configured Cashu mint URL, and boolean funded-fixture assertions; it does not
record seeds, addresses, tokens, proofs, or dev-client URLs.

`scripts/runLiveRegression.mjs` wraps the live Maestro runner with watchdogs and
proof checks. Strict profiles verify Mutinynet txids through Esplora and Sepolia
tx hashes through JSON-RPC. Token-link and fixture values are forwarded to
Maestro through environment variables and are not written to the redacted report.

## Quality Gate

Run the same gate enforced by CI:

```bash
npm run verify
```

This runs doctor, typecheck, lint, cleanup guardrails, dead-code detection,
Maestro flow validation, user-facing regression manifest validation, and Jest
with coverage thresholds.
