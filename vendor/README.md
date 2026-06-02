# Vendored Packages

The app vendors the exact `@ducat-unit/client-sdk@0.7.23` and `@ducat-unit/runestone@1.0.5` packages that were previously installed from GitHub Packages.

This keeps `npm ci` reproducible for GitHub Actions and clean local checkouts without requiring a private package token. The vendored copies include the React Native compatibility fixes previously applied by `patch-package`.

## Inventory

- `vendor/ducat-unit-client-sdk` - Ducat protocol client, guardian, oracle,
  vault, wallet, and utility exports consumed by the mobile app.
- `vendor/ducat-unit-runestone` - Ducat fork of the Runestone encoder/decoder
  used by UNIT Runes transaction flows.

Treat these folders as pinned package copies. Do not edit generated `dist/`
files by hand; refresh the vendored package version instead.
