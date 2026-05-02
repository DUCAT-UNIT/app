# Release Doctor

Run the release doctor before TestFlight uploads:

```bash
npm run release:doctor
```

Quick static-only pass:

```bash
npm run release:doctor -- --quick
```

Include critical Maestro runtime flows when a simulator is already booted with the native app installed:

```bash
npm run release:doctor -- --runtime-e2e
```

The release doctor checks:

- Mutinynet-only app/network invariants.
- Hidden USDC password invariant.
- Cold-install audit checklist availability.
- History completeness wiring.
- Async feedback/performance wiring.
- Maestro flow reference validation.
- TypeScript, ESLint, and focused Jest in the full pass.

It intentionally does not auto-submit to TestFlight. Build/upload stays a separate operator action after the local release gate passes.
