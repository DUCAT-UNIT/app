# UNIT Bridge Service

Operator bridge service for the Sepolia `UNIT <-> wUNIT` POC. It persists intents and redemptions to a local JSON snapshot, exposes the bridge/admin HTTP API, and can run in either:

- POC simulation mode: no live chain credentials, manual deposit simulation and admin actions only.
- Live runtime mode: watches Mutinynet custody deposits, fulfills intents on Sepolia, watches redemption burns, and executes Mutinynet releases.

## Endpoints

- `POST /bridge/intents`
- `GET /bridge/intents/:id`
- `POST /redemptions`
- `GET /redemptions/:id`
- `GET /health`
- `GET /admin/overview`
- `GET /admin/reconciliation`
- `GET /admin/pool`
- `POST /admin/liquidity/*`
- `POST /admin/bridge/pause`
- `POST /admin/pool/pause`
- `POST /admin/intents/:id/simulate-deposit`
- `POST /admin/intents/:id/resolve`
- `POST /admin/recovery/replay`
- `POST /admin/redemptions/:id/complete`

The admin dashboard is served from `/admin`.

## Environment

Copy `.env.example` and set the values you need.

Minimal POC mode:

- `UNIT_BRIDGE_RUNTIME_ENABLED=true`
- `UNIT_BRIDGE_LIVE_MODE=false`
- `UNIT_BRIDGE_ADMIN_TOKEN=...` if you want bearer auth on admin routes

Live runtime mode additionally requires:

- `UNIT_BRIDGE_MUTINYNET_MNEMONIC`
- `UNIT_BRIDGE_SEPOLIA_RPC_URL`
- `UNIT_BRIDGE_SEPOLIA_PRIVATE_KEY`
- `UNIT_BRIDGE_WUNIT_ADDRESS`
- `UNIT_BRIDGE_POOL_ADDRESS`
- `UNIT_BRIDGE_ROUTER_ADDRESS`

Optional but useful:

- `UNIT_BRIDGE_STATE_FILE`
- `UNIT_BRIDGE_SEPOLIA_START_BLOCK`
- `UNIT_BRIDGE_MUTINYNET_ESPLORA_URL`
- `UNIT_BRIDGE_MUTINYNET_ORD_URL`
- `UNIT_BRIDGE_MUTINYNET_CONFIRMATIONS`
- `UNIT_BRIDGE_SEPOLIA_CONFIRMATIONS`

## Run

```bash
cd bridge-service
npm install
npm run typecheck
npm run build
PORT=8788 npm start
```

Open `http://localhost:8788/admin`.

## External Deployment

Container build from the repo root:

```bash
docker build -f bridge-service/Dockerfile -t unit-bridge-sepolia .
```

Run the service with a real env file on your host or PaaS:

```bash
docker run --env-file bridge-service/.env -p 8788:8788 unit-bridge-sepolia
```

If you prefer a VM/process manager instead of containers:

```bash
cd bridge-service
npm install
npm run build
pm2 start ecosystem.config.cjs
```

Live Sepolia boot sequence:

```bash
cd evm
SEPOLIA_PRIVATE_KEY=... npm run deploy:sepolia

cd ..
SEPOLIA_BRIDGE_API_URL=https://bridge-sepolia.your-domain.tld npm run swap:sepolia:configure

cd bridge-service
npm run build
pm2 start ecosystem.config.cjs
```

`swap:sepolia:configure` is intentionally strict: it fails unless you provide a real external `SEPOLIA_BRIDGE_API_URL`, so the app cannot be configured against a fake placeholder.

## Notes

- Deposit intents are exact-amount only. Amount mismatches and stale intents go to manual recovery.
- Auto-swap attempts use the pool quote at fulfillment time and fall back to raw `wUNIT` if Sepolia swap guards fail.
- The live bridge remains operator-managed. There is no trust-minimized verification path in this POC.
