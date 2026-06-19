/**
 * @fileoverview Vault-script layout helpers. The DUCAT vault Taproot script tree
 * groups leaves per-guardian: each guardian's sub-tree contains one
 * cosign leaf followed by `thold_count` liquidation leaves (one per
 * price commit).
 */

import { Assert } from '@vbyte/util'

/**
 * Linear index of a liquidation leaf in the vault's flattened
 * script-tree leaf array.
 *
 * Layout (per guardian, repeated `guard_count` times):
 *   [ cosign_leaf, liquidation_leaf_0, liquidation_leaf_1, ...,
 *     liquidation_leaf_{thold_count - 1} ]
 *
 * Total leaves: `guard_count * (1 + thold_count)`. The cosign leaf
 * for guardian G sits at position `G * (1 + thold_count)`; its
 * liquidation leaves follow at offsets `+1` through `+thold_count`.
 *
 * @param guard_index - Zero-indexed guardian position (0 ≤ < guard_count).
 * @param thold_count - Number of price commits / liquidation leaves
 *                      per guardian.
 * @param thold_idx   - Zero-indexed position within the guardian's
 *                      liquidation leaves (0 ≤ < thold_count).
 * @returns Linear leaf index in the flattened script tree.
 * @throws  If any input is negative or `thold_idx >= thold_count`.
 */
export function get_liquid_script_idx (
  guard_index : number,
  thold_count : number,
  thold_idx   : number
) : number {
  Assert.ok(
    guard_index >= 0,
    `get_liquid_script_idx: guard_index must be >= 0 (got ${guard_index})`
  )
  Assert.ok(
    thold_count >= 1,
    `get_liquid_script_idx: thold_count must be >= 1 (got ${thold_count})`
  )
  Assert.ok(
    thold_idx >= 0 && thold_idx < thold_count,
    `get_liquid_script_idx: thold_idx must satisfy 0 <= idx < thold_count ` +
    `(got idx=${thold_idx}, count=${thold_count})`
  )
  return guard_index * (1 + thold_count) + 1 + thold_idx
}
