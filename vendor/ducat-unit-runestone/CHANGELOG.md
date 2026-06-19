# CHANGELOG

## [2.0.11] - 2026-05-01

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.4.13 -> 2.4.14).

## [2.0.10] - 2026-04-23

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.4.12 -> 2.4.13).

## [2.0.9] - 2026-04-22

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.4.9 -> 2.4.12, `@types/node` 25.5.0 -> 25.6.0, `typescript` 6.0.2 -> 6.0.3).

## [2.0.8] - 2026-03-26

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.4.5 -> 2.4.9, `@types/node` 25.3.3 -> 25.5.0, `typescript` 5.9.3 -> 6.0.2).
- Added TypeScript 6 deprecation guards to project/test `tsconfig` files.

## [2.0.7] - 2026-03-04

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.4.4 -> 2.4.5, `@types/node` 25.3.1 -> 25.3.3).

## [2.0.6] - 2026-02-26

### Changed
- Updated dev dependencies via ncu (`@types/node` 25.3.0 -> 25.3.1).

## [2.0.5] - 2026-02-20

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.4.2 -> 2.4.3).

## [2.0.4] - 2026-02-19

### Changed
- Updated dev dependencies via ncu (`@types/node` 25.2.3 -> 25.3.0).

## [2.0.3] - 2026-02-17

### Changed
- Updated dev dependencies via ncu (`@biomejs/biome` 2.3.13 → 2.4.2, `@types/node` 25.0.10 → 25.2.3).

### Fixed
- `tryDecodeRunestone` now catches exceptions from `Runestone.decipher` and returns `null` instead of throwing.
- `Runestone.decipher` returns `Flaw.INVALID_SCRIPT` instead of throwing when script decompilation fails.

## [2.0.2] - 2026-02-16

### Changed
- Replaced Node `Buffer` usage with `@vbyte/buff` across runtime encode/decode paths and tests.
- Aligned TypeScript toolchain and config with `core-ts` conventions:
  - NodeNext/ESNext project config
  - strict ESM package mode (`"type": "module"`)
  - pinned TypeScript-related dev dependency versions
- Updated internal source imports to NodeNext-compatible `.js` specifiers.
- Updated test harness to ESM-compatible Tape import style.
- Refined monad typing to remove lint warnings and tighten `None` typing.

## [2.0.1] - 2026-02-16

### Changed
- Refactored package surface to core-ts style:
  - Root `index.ts` is now export-only.
  - Added `src/index.ts` export hub.
  - Split public API logic into `src/lib/*`.
  - Split public API types into `src/types/*`.
- Added core-style packaging scripts:
  - `scripts/build.sh`
  - `scripts/package.sh`
  - `scripts/release.sh`
- Migrated linting to Biome with a new `biome.json` config.
- Removed `.prettierrc` and standardized on Biome for lint workflow.

## [2.0.0] - 2026-02-16

### Breaking
- Removed indexer and RPC exports from package entrypoint:
  - `RunestoneIndexer`, `RuneUpdater`, and related indexer/storage types
  - `Network`
  - `BitcoinRpcClient` and RPC request/response types

### Changed
- Narrowed library scope to runestone encode/decode primitives used by DUCAT services.
- Updated README to document the minimal supported API.
- Migrated test runner from Jest to Tape with a lightweight compatibility harness.
- Removed `lodash` and `@types/lodash` from devDependencies by replacing test helpers with native JS.

### Kept
- `encodeRunestone`
- `tryDecodeRunestone`
- `isRunestone`
- Types: `RunestoneSpec`, `Cenotaph`, `Flaw`
