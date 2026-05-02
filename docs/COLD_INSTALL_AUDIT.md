# Cold Install Audit

Use this when judging the app from a clean environment rather than an already-warmed simulator.

Command:

```bash
npm run cold-install:audit -- --inspect-simulator
```

Optional destructive simulator reset:

```bash
npm run cold-install:audit -- --reset-app
```

Audit flow:

1. Native-install the app into a booted iOS simulator, not Expo Go.
2. Start with no app data, create a wallet, and confirm onboarding reaches the wallet without blank or stuck screens.
3. Confirm all Bitcoin addresses and copy say Mutinynet/testnet, and that no mainnet or remote-config picker exists.
4. Confirm USDC and Sepolia ETH surfaces are hidden by default.
5. Enable Developer Mode, unlock `Enable USDC` with `fx-570ES PLUS`, and confirm Sepolia ETH/USDC surfaces appear.
6. Exercise BTC and UNIT send forms through edit -> review -> auth/submit; no editable form should autosend.
7. Exercise Sepolia ETH/USDC send through edit -> review -> pending/recovery; pending checkpoints must survive relaunch.
8. Exercise vault open/borrow/repay/deposit/withdraw through review -> busy -> pending -> confirmed/recoverable.
9. Disable network during vault/liquidation load; last good data should remain visible with stale/error copy.
10. Re-enable network and confirm background refresh clears stale state without repeated taps.

Pass criteria:

- No blank first-launch screens.
- No hidden Sepolia/USDC surface leakage while the flag is off.
- No money-moving flow submits directly from an edit form.
- No pending operation disappears after force quit/relaunch.
- Stale data is visible and labeled instead of replacing dashboards with empty loading states.
