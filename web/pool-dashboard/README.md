# UNIT/USDC Pool Dashboard

Standalone local web dashboard for the Mutinynet app's Sepolia UNIT/USDC stable pool diagnostics. It mirrors the mobile `SwapDiagnosticsScreen` pool card and reads the same pool contract methods: readiness, reserves, implied UNIT price, imbalance, max input, quote samples, optional wallet balances/allowances, and recent browser snapshots/errors.

This is test-network tooling only. It does not represent mainnet or production liquidity.

## Run

```bash
cd /Users/lucasrodriguez/Desktop/Ducat/mobile-app/app/web/pool-dashboard
npm install
npm run dev
```

Open the printed local Vite URL, usually `http://127.0.0.1:5173`.

## Build Check

```bash
cd /Users/lucasrodriguez/Desktop/Ducat/mobile-app/app/web/pool-dashboard
npm run build
```

## Environment

The Vite config exposes both `VITE_` variables and the mobile app's `EXPO_PUBLIC_` names so an existing mobile env can be reused.

Required for pool reads:

```bash
EXPO_PUBLIC_SEPOLIA_RPC_URL=https://...
EXPO_PUBLIC_WUNIT_ADDRESS=0x...
EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS=0x...
```

Recommended for full bridge readiness:

```bash
EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS=0x...
EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS=0x...
EXPO_PUBLIC_UNIT_BRIDGE_API_URL=https://...
```

`EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS` defaults to Sepolia USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` when omitted.

Web-safe aliases are also supported:

```bash
VITE_SEPOLIA_RPC_URL=https://...
VITE_SEPOLIA_USDC_ADDRESS=0x...
VITE_WUNIT_ADDRESS=0x...
VITE_UNIT_BRIDGE_ROUTER_ADDRESS=0x...
VITE_UNIT_USDC_STABLE_POOL_ADDRESS=0x...
VITE_UNIT_BRIDGE_API_URL=https://...
```

Optional wallet diagnostics:

```bash
VITE_POOL_DASHBOARD_WALLET_ADDRESS=0x...
```

A private key can be supplied only to derive the wallet address for read-only balance and allowance checks:

```bash
VITE_POOL_DASHBOARD_PRIVATE_KEY=0x...
```

Do not use a funded production key. Browser env variables are exposed to the client bundle. Prefer `VITE_POOL_DASHBOARD_WALLET_ADDRESS` for diagnostics.

## Notes

- The dashboard uses Sepolia chain id `11155111`.
- Quote samples are `1`, `10`, and `100`, matching the mobile diagnostics.
- Recent snapshots are stored in browser `localStorage` under `ducat:pool-dashboard:snapshots:v1`.
- No mobile app files are imported or modified by this web dashboard.
