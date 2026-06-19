# Frontend Dev V3 Parity

This document tracks the mobile app behavior that is expected to stay aligned with the Ducat frontend `origin/dev` v3 protocol path.

## Baseline

- Frontend comparison point: `/Users/lucasrodriguez/Desktop/Ducat/frontend-dev-liquidation-validator-fixes`, `origin/dev`.
- Frontend `origin/dev` baseline commit: `09e0e40f68a658d544c91d2b8d306067c284d07d`.
- Protocol SDK versions:
  - `@ducat-unit/client-sdk`: `0.25.2`
  - `@ducat-unit/core`: `0.22.1`
  - `@ducat-unit/runestone`: `2.0.11`
- Mobile network scope: Mutinynet only.

## Core URLs

| Purpose | Mobile URL |
| --- | --- |
| Validator | `https://validator-mutinynet.dev.ducatprotocol.com` |
| Relay HTTP | `https://relay-mutinynet.dev.ducatprotocol.com` |
| Oracle relay WS | `wss://relay-mutinynet.dev.ducatprotocol.com` |
| Oracle pubkey | `a12736a47c9e8f20c863bff8c35fa7db2d79875e5812f419799da2e8ec7cd41e` |
| Oracle / watchtower | `https://oracle-mutinynet.dev.ducatprotocol.com` |
| Tools | `https://tools-mutinynet.dev.ducatprotocol.com` |
| Guardian WS | `wss://guardian-1-mutinynet.dev.ducatprotocol.com/ws` |
| Explorer API | `https://explorer-mutinynet.dev.ducatprotocol.com/api` |
| Explorer UI | `https://explorer-mutinynet.dev.ducatprotocol.com` |
| Ord API | `https://ord-mutinynet.ducatprotocol.com` |
| TurboUNIT Cashu mint | `https://dev-cashu-mint.ducatprotocol.com` |
| Liquidation swap | `https://faucet.ducatprotocol.com/unit/faucet/test` |
| BTC faucet | `https://faucet.ducatprotocol.com/btc/faucet` |

## Price Policy

Oracle-relay first is the mobile parity rule for BTC/USD display price. `fetchBtcPrice()` must try the same relay-backed oracle path used by frontend dev before it falls back to validator `/api/price/latest` or CoinGecko.

Protocol actions must continue to use signed oracle data from `wss://relay-mutinynet.dev.ducatprotocol.com`. CoinGecko is display-only fallback data and must not be used to construct vault or liquidation requests.

The action quote freshness window is five minutes, matching guardian validation.

## Liquidation Policy

Frontend dev uses the SDK helper `fetch_liquid_sample(...)`, which calls `/api/liquid/sample?price=...` and returns a capped sample.

Mobile intentionally uses the full validator feed:

- `GET /api/liquid/vaults?page_size=250`
- cursor pagination up to the mobile guardrail
- terminal action filtering for already-taken rows
- expired embedded quote filtering for legacy-shaped rows

This is a product-visible difference, not an accidental parity gap. Mobile should show the full opportunity set while using the same v3 `VaultProfile` shape and SDK action builders.

## Action Parity

The following mobile flows should stay on the same v3 SDK family as frontend dev:

- open
- borrow
- repay
- deposit
- withdraw
- repo
- trim

The mobile implementation may differ in signing surface because it uses native wallet state rather than browser extension connectors. The SDK request shape, quote source, protocol profile, guardian submission semantics, and validator/relay network should remain aligned.

The SDK-exported `close` action is not a current mobile parity requirement because there is no mobile close workflow today. Building it would be a separate product change.

## Guard

Run:

```sh
npm run parity:check
```

The check is static and fast. It verifies SDK pins, Mutinynet service defaults, oracle-relay first BTC price behavior, and the intentional mobile full-feed liquidation endpoint.
