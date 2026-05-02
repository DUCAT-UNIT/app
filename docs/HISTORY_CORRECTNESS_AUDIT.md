# History Correctness Audit

The minimum complete history model covers these sources:

| Source | Required Display Behavior |
| --- | --- |
| Confirmed BTC history | Shows normal send/receive activity from Mutinynet indexer. |
| Pending BTC sends | Shows immediately from `pendingTransactionsStore` before confirmation. |
| Confirmed UNIT history | Shows UNIT sends, swaps, and received UNIT from normal indexed history. |
| Pending UNIT sends | Shows immediately from `pendingTransactionsStore` before confirmation. |
| Ecash activity | Shows mint/receive/send/convert activity from ecash stores. |
| Vault activity | Shows indexed vault open/borrow/repay/deposit/withdraw/repo records. |
| Pending vault activity | Shows from `pendingVaultTransactionStore` until indexed vault history confirms it. |
| Sepolia ETH history | Shows indexed ETH transfer history plus submitted EVM transfer checkpoints. |
| Sepolia USDC history | Shows indexed USDC transfer history plus submitted EVM transfer checkpoints. |
| Sepolia self-send | Must remain visible and be labeled as movement to self, not hidden as a zero net change. |
| Swap/redeem checkpoints | Must appear as pending/recoverable/confirmed while the app owns checkpoint data. |

Static audit command:

```bash
npm run history:audit
```

Runtime checks:

1. Submit a BTC send, close before confirmation, relaunch, and confirm pending history remains.
2. Submit a UNIT send, close before confirmation, relaunch, and confirm pending history remains.
3. Submit Sepolia ETH to self; ETH asset history and global history must show it.
4. Submit Sepolia USDC to self; USDC asset history and global history must show it.
5. Trigger a swap/redeem checkpoint and force quit before indexer confirmation; recovery/history must explain the pending state.
6. Trigger a vault operation and force quit before indexed confirmation; vault activity must show the pending operation.
