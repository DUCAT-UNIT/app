/**
 * @fileoverview Transaction-sizing helpers for vault actions. Currently exposes
 * `get_vault_action_sigops_count`, the per-input sigops count used
 * by client-sdk's fee-rate validation. The sigops totals scale with
 * the number of vault inputs (vault + connector for cosigned
 * actions); each entry is the per-input count.
 */

import { SIGCOUNT } from '@/const.js'

import type { VaultAction } from '@/types/index.js'

/**
 * Per-input sigops count for the selected vault action path.
 *
 * Returns the per-input sigops count (not the per-tx total). Callers
 * compose this with input counts when computing effective vsize for
 * fee-rate validation — see `client-sdk/.../vault/lib/verify.ts`
 * and `get_sigops_vsize` for the conversion to vbytes.
 *
 * @param vault_action - The vault action whose path to count.
 * @returns Sigops count.
 * @throws Error if the action is not recognized.
 */
export function get_vault_action_sigops_count (
  vault_action : VaultAction
) : number {
  switch (vault_action) {
    case 'open':      return SIGCOUNT.VAULT_OPEN
    case 'borrow':    return SIGCOUNT.VAULT_BORROW
    case 'repay':     return SIGCOUNT.VAULT_REPAY
    case 'close':     return SIGCOUNT.VAULT_CLOSE
    case 'repo':      return SIGCOUNT.VAULT_REPO
    case 'trim':      return SIGCOUNT.VAULT_TRIM
    case 'deposit':   return SIGCOUNT.VAULT_DEPOSIT
    case 'withdraw':  return SIGCOUNT.VAULT_WITHDRAW
    case 'liquidate': return SIGCOUNT.VAULT_LIQUIDATE
    default: {
      const _exhaustive : never = vault_action
      throw new Error(`get_vault_action_sigops_count: unknown vault action: ${_exhaustive}`)
    }
  }
}
