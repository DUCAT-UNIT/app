# Recovery Matrix

The app now treats money-moving paths as operations with a durable journal entry. Domain stores still own balances, checkpoints, vault data, and transaction history; the journal is the UI/control-plane record used to explain what happened after relaunch or retry.

| Flow | Source of Truth | Journal Kind | Pending State | Safe Retry Rule | Recovery Copy |
| --- | --- | --- | --- | --- | --- |
| BTC send | `pendingTransactionsStore` | `btc_send` | Mutinynet tx submitted, not yet confirmed | Unsafe until the tx is confirmed or invalidated | Wait for Mutinynet confirmation before spending the same funds again. |
| UNIT send | `pendingTransactionsStore` | `unit_send` | Mutinynet tx submitted, not yet confirmed | Unsafe until the tx is confirmed or invalidated | Wait for Mutinynet confirmation before spending the same funds again. |
| Vault open | `pendingVaultTransactionStore` | `vault_open` | Funding/vault tx submitted | Unsafe while pending | Wait for vault confirmation before submitting another vault operation. |
| Vault borrow | `pendingVaultTransactionStore` | `vault_borrow` | Vault tx submitted | Unsafe while pending | Wait for vault confirmation before submitting another vault operation. |
| Vault repay | `pendingVaultTransactionStore` | `vault_repay` | Vault tx submitted | Unsafe while pending | Wait for vault confirmation before submitting another vault operation. |
| Vault deposit | `pendingVaultTransactionStore` | `vault_deposit` | Vault tx submitted | Unsafe while pending | Wait for vault confirmation before submitting another vault operation. |
| Vault withdraw | `pendingVaultTransactionStore` | `vault_withdraw` | Vault tx submitted | Unsafe while pending | Wait for vault confirmation before submitting another vault operation. |
| Liquidation/repo | `pendingVaultTransactionStore` | `vault_repossess` | Repo tx submitted | Unsafe while pending | Wait for liquidation confirmation before submitting another vault operation. |
| Sepolia ETH/USDC transfer | `evmTransactionCheckpointStore` | `evm_transfer` | EVM tx submitted, receipt/indexer not final | Unsafe until checked | Check pending Sepolia transaction before retrying. |
| Sepolia approval | `evmTransactionCheckpointStore` | `evm_approval` | Approval tx submitted | Unsafe until checked | Check pending Sepolia transaction before retrying. |
| Sepolia swap | `evmTransactionCheckpointStore` | `evm_swap` | Swap tx submitted | Unsafe until checked | Check pending Sepolia transaction before retrying. |
| Sepolia redemption | `evmTransactionCheckpointStore` | `evm_redeem` | Burn/redeem tx submitted | Unsafe until checked | Check pending Sepolia transaction before retrying. |

Retry language:

- `unsafe_until_checked`: do not submit a matching operation until the app checks chain/indexer state.
- `safe_to_retry`: balances were refreshed or the prior tx failed/reverted; retry is acceptable.
- `not_retryable`: operation confirmed; no duplicate retry should be offered.
- `unknown`: edit/review state or an operation without enough chain context.

Release expectation:

- Every money-moving screen must show review before auth/submit.
- Every submitted operation must either appear in normal history, a checkpoint/recovery card, or the operation journal after relaunch.
- Terminal journal entries can expire after seven days, but pending entries must remain until confirmed, failed, or explicitly cleared by wallet reset.
