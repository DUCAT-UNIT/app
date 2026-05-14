# Repository Boundaries

This repo is primarily the Ducat mobile app. The adjacent bridge and EVM folders are kept in tree
for local integration work, but they should not be treated as mobile app source.

## Current Ownership

- `components/`, `contexts/`, `hooks/`, `navigation/`, `screens/`, `services/`, `stores/`,
  `utils/`: mobile app runtime.
- `bridge-service/`: backend bridge service workspace. The mobile app talks to it through HTTP
  clients such as `services/bridgeApiService.ts`.
- `evm/`: contract and Hardhat workspace. The mobile app must not import contract scripts,
  artifacts, tests, or Hardhat config directly.
- `web/`: web-only dashboards and tools. The mobile app must not import UI or build artifacts from
  here.
- `shared/`: narrow typed contract surface shared by the app and bridge service. Keep this folder
  small and limited to serializable request/response types.

## Rules

- Mobile runtime code may import from `shared/` only for API contract types.
- Mobile runtime code must not import from `bridge-service/`, `evm/`, or `web/`.
- Cross-workspace behavior should move through an API, generated contract artifact, or explicit
  shared type.
- If a workspace grows beyond local integration support, split it into a package or separate repo
  before adding mobile runtime dependencies on it.

`npm run guard:cleanup` enforces the no-runtime-import rule for `bridge-service/`, `evm/`, and
`web/`.
