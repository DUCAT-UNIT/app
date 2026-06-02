# @ducat-unit/client-sdk

Vendored copy of `@ducat-unit/client-sdk@0.7.23`.

The mobile app depends on this package through:

```json
"@ducat-unit/client-sdk": "file:vendor/ducat-unit-client-sdk"
```

## What It Provides

- Guardian WebSocket client exports
- Oracle and indexer fetch helpers
- Vault transaction construction and validation helpers
- Reference wallet utilities used by the mobile app
- Shared protocol types and utility functions

## Maintenance Notes

This folder is treated as a pinned package artifact. Do not hand-edit generated
files under `dist/`. To change SDK behavior, update the source package, rebuild
it, then replace this vendored copy as one coherent version bump.

The vendored package keeps CI and fresh local installs reproducible without a
private package registry token.
