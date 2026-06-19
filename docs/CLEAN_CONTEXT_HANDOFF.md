# Clean Context Handoff

This document is the maintained starting point for a fresh technical review of the repo.

## What This App Is

DUCAT Wallet is a Mutinynet-only Expo/React Native wallet for BTC, on-chain Ducat UNIT Runes, TurboUNIT Cashu e-cash, and UNIT vault flows.

The app is intentionally testnet-only. Mainnet support, runtime network switching, and remote app-network config are out of scope.

## Start Here

From the repository root, enter the Expo app directory:

```bash
cd app
git status --short --branch
npm ci
npm run verify
```

`npm run verify` is the default quality gate. It runs:

- `npm run doctor`
- TypeScript typecheck
- ESLint in quiet mode
- `knip` dead-code detection
- Maestro flow validation
- Jest coverage in band

The shell may be on Node 24. Project scripts route through `scripts/run-node22.mjs`, and `npm run doctor` reports the pinned Node 22 fallback when needed.

## Cashu UNIT Invariants

The current Ducat Cashu mint is:

```text
https://dev-cashu-mint.ducatprotocol.com
```

Ducat UNIT must use the advertised generic Cashu method:

```text
method: onchain
unit: unit
rune_id: 3007902:1
```

Do not reintroduce:

- `method: unit`
- `method: runes`
- `unit: sat` for Ducat UNIT
- `/v1/mint/quote/unit`
- `/v1/mint/unit`
- `/v1/melt/quote/unit`
- `/v1/melt/unit`

The app enforces these in `npm run doctor`. The live doctor also probes the mint `/v1/info` and fails unless `nuts["4"].methods` advertises `{ method: "onchain", unit: "unit" }`.

Cashu token handling is v4-only:

- `@cashu/cashu-ts` is installed at `^4.1.0`.
- Tokens must be `cashuB`.
- `sat` tokens are treated as BTC/Lightning only and rejected for Ducat UNIT redemption.
- `GET /v1/keys/{id}` is handled as `{ "keysets": [...] }`.
- 66-character keyset IDs are valid.
- `input_fee_ppk` is included in swap and melt change calculations.

## Live Maestro Boundary

Maintained product E2E flows must drive the normal app UI:

```bash
npm run e2e
npm run e2e:send
npm run e2e:validate
```

Live TurboUNIT smoke tests are separate because they require funded Mutinynet and Sepolia fixtures and can spend test funds:

```bash
npm run doctor:live
npm run e2e:live:turbo
```

Successful live runs write redacted evidence to `artifacts/live-maestro/last-run.json` by default. That artifact is local-only and ignored by git.

`utils/e2e.ts` must not treat `__DEV__` as E2E. Live flows exercise the normal dev-client app bundle.

## Maintained Docs

Maintained workflow docs live in `docs/` and `scripts/README.md`.

Useful maintained docs:

- `docs/RELEASE_DOCTOR.md`
- `docs/RECOVERY_MATRIX.md`
- `docs/STATE_MANAGEMENT.md`
- `scripts/README.md`

## Scorecard For A Fresh Review

A clean context should score the repo against these pass criteria:

- Build hygiene: `npm run verify` passes without local code changes.
- Release hygiene: `npm run release:doctor -- --quick` passes before TestFlight handoff.
- Network invariant: `npm run doctor` confirms Mutinynet-only runtime and no remote network switching.
- Cashu correctness: only `onchain/unit` Ducat mint and melt endpoints are present.
- Cashu v4 compatibility: only `cashuB` tokens are accepted for Ducat UNIT, and `sat` tokens are rejected.
- E2E clarity: deterministic Maestro flows and live funded smoke flows are clearly separated.
- Security hygiene: sensitive token, witness, QR payload, short URL, and raw response logging guards pass.
- Repo hygiene: stale reports and one-off analysis files are not committed with maintained docs.

Do not mark the repo down for not running `e2e:live:turbo` unless funded fixture environment variables and live test funds are provided. The correct non-spending evidence is `npm run verify`; the correct live readiness evidence is `npm run doctor:live`.
