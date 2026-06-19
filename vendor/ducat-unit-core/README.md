# DUCAT Core Library

![Version](https://img.shields.io/badge/version-0.22.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)

Core libraries, schemas and interfaces for the DUCAT protocol. A comprehensive TypeScript library for Bitcoin-related functionality including assets, commits, inscriptions, sequences, vaults, and protocol operations.

For a detailed explanation of the DUCAT protocol, see [docs/DUCAT.md](docs/DUCAT.md).

## Overview

The DUCAT Core Library provides essential building blocks for working with the DUCAT protocol on Bitcoin. It offers a modular architecture with type-safe interfaces for:

- **Asset Management**: Create, validate, and manipulate Bitcoin assets
- **Transaction Processing**: PSBT utilities for Bitcoin transaction handling
- **Protocol Operations**: Core DUCAT protocol implementation
- **Vault Operations**: Secure asset storage and management
- **Validation & Schemas**: Runtime validation using Zod schemas
- **Type Safety**: Comprehensive TypeScript definitions

**Target Audience**: Bitcoin developers, protocol implementers, and applications building on the DUCAT protocol.

## Installation

```bash
npm install @ducat-unit/core
```

**Note**: This package is published to GitHub Packages with restricted access. Ensure you have proper authentication configured.

## Architecture

The library follows a modular architecture with six main modules accessible via dedicated exports:

### Module Structure

```
@ducat-unit/core/
├── lib        # Core implementation libraries
├── psbt       # PSBT (Partially Signed Bitcoin Transaction) utilities
├── schema     # Zod validation schemas
├── types      # TypeScript type definitions
├── validate   # Validation and assertion utilities
└── const      # Protocol constants and configuration
```

### Package Exports

The library provides multiple entry points for efficient tree-shaking:

```typescript
// Main entry - all modules
import { CONST, LIB, PSBT, SCHEMA, VALIDATE } from '@ducat-unit/core'

// Specific modules
import * as LIB from '@ducat-unit/core/lib'
import * as PSBT from '@ducat-unit/core/psbt'
import * as SCHEMA from '@ducat-unit/core/schema'
import * as TYPES from '@ducat-unit/core/types'
import * as VALIDATE from '@ducat-unit/core/validate'
import * as CONST from '@ducat-unit/core/const'
```

## API Reference

For the public callable surface — every subpath module, its primary functions
with signatures, and the `RpcClient` / `GuardianSigner` classes — see
[docs/API.md](docs/API.md). Protocol constants are documented in
[docs/CONSTANTS.md](docs/CONSTANTS.md). Data shapes are defined in the
[`types`](src/types/index.ts) module; runtime validation lives in
[`schema`](src/schema/index.ts) and [`validate`](src/validate/index.ts).

## Security Considerations

The full threat model, trust assumptions, and validation requirements are in
[docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md). The load-bearing controls:

- **Secret-key isolation** — `GuardianSigner` holds the signer secret key in a
  module-private `WeakMap`; instances expose no key getter or extraction
  primitive, so holding a signer never yields the key.
- **Boundary validation** — external input is validated at the boundary with Zod
  schemas (`schema`) and `@vbyte/util` assertions (`validate`); malformed hex,
  out-of-range, `NaN`/`Infinity`, and oversized inputs are rejected before use.
- **Numeric safety** — sat/UNIT and ratio math is guarded by `Number.isSafeInteger`
  / `Number.isFinite` and uses integer-scaled arithmetic to bound rounding;
  non-finite and negative monetary values are rejected.
- **Signature verification** — BIP340 signatures are verified for guardian
  co-signing and oracle price contracts; no roll-your-own crypto (uses
  `@vbyte/crypto` / `@scure/btc-signer`).
- **RPC transport guard** — `RpcClient` refuses non-HTTPS endpoints unless they
  are loopback or explicitly opted in, mitigating credential exposure / SSRF.
- **Fail-fast error handling** — invariants throw descriptive, contextual errors
  rather than failing silently (see the "Error Handling Patterns" section of the
  security model).
- **Supply chain** — a small, pinned dependency set; no postinstall scripts.

## Development

### Building

```bash
npm run build
```

Runs the complete build pipeline:
1. TypeScript compilation
2. Rollup bundling for distribution
3. Path alias resolution (`@/*` → relative paths)

### Testing

```bash
npm test
```

Runs the comprehensive test suite using Tape framework with faucet output formatting.

#### Running Specific Tests

```bash
npm run script test/lib/asset.test.ts    # Run specific test file
npm run scratch                          # Run experimental code
```

### Linting

```bash
npm run lint        # Check code style
npm run lint:fix    # Auto-fix issues
```

Uses Biome linter with strict rules for unused imports and variables.

### Full Package Pipeline

```bash
npm run package     # lint → test → build
npm run release     # Create and push git tags
```

## Dependencies

### Core Dependencies

- **[@ducat-unit/runestone](https://github.com/DUCAT-UNIT/runestone)**: Runestone protocol implementation
- **[@scure/btc-signer](https://github.com/paulmillr/scure-btc-signer)**: Bitcoin signing utilities
- **[@vbyte/btc-dev](https://github.com/vbyte-org/btc-dev)**: Bitcoin development tools
- **[@vbyte/buff](https://github.com/vbyte-org/buff)**: Buffer utilities for Bitcoin operations
- **[@vbyte/util](https://github.com/vbyte-org/util)**: Utility functions library
- **[@vbyte/crypto](https://github.com/vbyte-org/crypto)**: Cryptographic utilities
- **[zod](https://github.com/colinhacks/zod)**: Runtime validation schemas

### Development Dependencies

- **TypeScript 5.9+**: For type safety and compilation
- **Rollup**: Module bundling for distribution
- **Biome**: Code linting and formatting
- **Tape**: Unit testing framework
- **tsx**: TypeScript execution without compilation
