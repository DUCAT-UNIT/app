# Hook Tests

This directory contains Jest coverage for app hooks. Keep this README because
hook tests have a few local conventions that are easier to find here than in the
top-level testing docs.

## Current Status

- Hook tests run in the main Jest suite.
- Use targeted test paths when iterating on a single hook or hook family.
- Prefer `npm test -- --runInBand` when debugging stateful or timer-heavy hooks.

## Common Commands

```bash
# Run the full unit test suite
npm test -- --runInBand

# Run only hook tests
npm test -- --runInBand hooks/__tests__

# Run a single hook test file
npm test -- --runInBand hooks/__tests__/useWalletImport.test.tsx

# Detect lingering async work while debugging
npm test -- --runInBand --detectOpenHandles hooks/__tests__
```

## Test Guidelines

When adding or updating a hook test:

1. Create or update the matching file in `hooks/__tests__/`.
2. Mock external modules and services with `jest.mock()`.
3. Use fake timers for timeout or interval-driven behavior.
4. Assert cleanup on unmount for subscriptions, timers, and listeners.
5. Cover security-sensitive branches, error handling, and rapid state changes.

## Priority Areas

If additional hook coverage is needed, prioritize:

1. Authentication and lock-state hooks.
2. Wallet initialization, import, and lifecycle hooks.
3. Transaction-building and signing-adjacent hooks.
4. Cashu, Turbo BTC/UNIT, and recovery-related hooks.
5. Navigation hooks that route through auth or destructive actions.

## Notes

- Keep tests co-located and focused on observable behavior.
- Avoid relying on implementation details when a user-visible outcome can be asserted instead.
- If a hook becomes unreachable in the product, remove its test alongside the code.
