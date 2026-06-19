/**
 * @fileoverview Helper functions for vault action verification.
 */

import { parse_psbt }   from '@/psbt/parse.js'
import { parse_tx_data } from '@/lib/txdata.js'

import type { PolicyFlag, ProtoTxData, PSBTData } from '@/types/index.js'

/**
 * Run an action's strict invariant checks, then its policy evaluation, and
 * throw on the first policy flag. This is the shared "reject-everything"
 * orchestration used by the liquidation composites (verify_vault_trim /
 * verify_vault_repo).
 *
 * Strict and policy are passed as thunks (rather than forwarded args) because
 * some actions — `trim`, `repo` — feed extra liquidation arguments to the
 * strict check that the policy evaluator does not take.
 *
 * @param label      - Composite name, used in the thrown error message.
 * @param run_strict - Runs the action's `*_strict` invariant checks (may throw).
 * @param run_policy - Runs the action's `eval_*_policy` evaluator; returns flags.
 * @throws {Error} On the first policy flag, formatted `${label} [code]: detail`.
 */
export function compose_strict_policy (
  label      : string,
  run_strict : () => void,
  run_policy : () => PolicyFlag[]
) : void {
  run_strict()
  const flags = run_policy()
  if (flags.length > 0) {
    throw new Error(`${label} [${flags[0].code}]: ${flags[0].detail}`)
  }
}

/**
 * Convert a PSBT to ProtoTxData for validation.
 *
 * @param vault_psbt - PSBT data as string, bytes, or parsed PSBTData
 * @returns Parsed transaction data
 */
export function parse_vault_tx_from_psbt (
  vault_psbt : string | Uint8Array | PSBTData
) : ProtoTxData {
  const pdata = parse_psbt(vault_psbt)
  return parse_tx_data(pdata.hex)
}

/**
 * Deep equality check for guard member arrays.
 * Compares two arrays of guard member pubkeys, ignoring order.
 *
 * @param a - First array of guard member pubkeys
 * @param b - Second array of guard member pubkeys
 * @returns true if arrays contain the same members
 */
export function guard_members_equal (
  a : string[],
  b : string[]
) : boolean {
  if (a.length !== b.length) return false
  const sorted_a = [...a].sort()
  const sorted_b = [...b].sort()
  return sorted_a.every((v, i) => v === sorted_b[i])
}
