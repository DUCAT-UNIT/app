# @ducat-unit/runestone

Vendored copy of `@ducat-unit/runestone@1.0.5`, the Ducat fork of the Magic Eden
Runestone library.

The mobile app depends on this package through:

```json
"@ducat-unit/runestone": "file:vendor/ducat-unit-runestone"
```

## What It Provides

- Runestone encoding and decoding
- Rune ID, edict, etching, and artifact types
- Helpers used by UNIT Runes transaction construction and validation

## Maintenance Notes

This folder is treated as a pinned package artifact. Do not hand-edit generated
files under `dist/`. To change Runestone behavior, update the source package,
rebuild it, then replace this vendored copy as one coherent version bump.

The vendored package keeps CI and fresh local installs reproducible without a
private package registry token.
