# Performance Trace Pass

Target user complaint:

Small pauses occur during API calls, some navigation buttons require multiple taps, and some forms may not clear reliably.

Static audit:

```bash
npm run perf:audit
```

Manual trace sequence:

1. Cold launch to wallet first paint.
2. Wallet refresh with good network.
3. Wallet refresh with network disabled, then restored.
4. Liquidation dashboard first load, stale render, failed refresh, successful refresh.
5. Vault detail first load, stale render, failed refresh, successful refresh.
6. BTC send edit -> review -> back -> edit -> review.
7. UNIT send edit -> review -> back -> edit -> review.
8. Sepolia USDC send edit -> review -> pending checkpoint -> relaunch recovery.
9. Vault borrow edit -> review -> pending -> relaunch recovery.

Pass criteria:

- First-load skeletons appear only when there is no usable cached data.
- Background refresh uses inline refreshing/stale labels, not full-screen blank loading.
- Primary buttons enter busy/disabled state immediately after tap.
- Auth/submit/checkpoint recovery stages ignore duplicate navigation and submit presses.
- Back navigation remains available in edit/review/recoverable states, and blocked only while auth/submit is actively running.
- Forms clear only after confirmed submit or explicit cancel, not after failed/recoverable checkpoints.
