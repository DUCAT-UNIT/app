/**
 * @fileoverview Verify a vault close action meets all protocol requirements.
 * Close is a terminal action that returns collateral when the vault is cleared.
 */

import { Assert } from '@vbyte/util'

import { verify_cleared_vault } from '@/lib/vault/validate.js'
import { guard_members_equal }  from '../util.js'

import type { ProtoProfile, VaultProfile } from '@/types/index.js'

/**
 * Verify a vault close action.
 *
 * Close action requirements:
 * - Previous vault must be cleared (no debt)
 * - Guard members must remain unchanged
 * - Client pubkey must remain unchanged
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Current vault profile (final state)
 * @param prev_profile  - Previous vault profile
 * @throws Error if any verification fails
 */
export function verify_vault_close (
  _proto_profile : ProtoProfile,
  vault_profile  : VaultProfile,
  prev_profile   : VaultProfile
) : void {
  // Close finalizes a cleared vault lineage; no debt-bearing state is allowed
  // entering this terminal transition.

  // Previous vault must be cleared (no debt)
  verify_cleared_vault(prev_profile)

  // Post-state must ALSO be cleared (Codex finding #16). A close
  // transaction's OP_RETURN can validly decode to an encumbered payload
  // (unit_balance > 0, price_stamp/price_commits populated) which
  // `create_vault_close_profile` spreads into the terminal profile. The
  // pre-state cleared check above proves the vault entered close in a
  // cleared state; this check proves the terminal profile is genuinely
  // cleared. Without it, attacker-controlled close OP_RETURN payloads
  // can populate ghost debt/price metadata on a closed vault.
  verify_cleared_vault(vault_profile)

  // Guard members must remain unchanged
  Assert.ok(
    guard_members_equal(vault_profile.guard_members, prev_profile.guard_members),
    'verify_vault_close: guard members must remain unchanged'
  )

  // Client pubkey must remain unchanged
  Assert.ok(
    vault_profile.client_pubkey === prev_profile.client_pubkey,
    'verify_vault_close: client pubkey must remain unchanged'
  )

  // Root txid must remain unchanged (vault lineage)
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_close: root_txid must remain unchanged'
  )

  // Close is terminal: no active vault UTXO/profile value remains.
  Assert.ok(vault_profile.coin_id === null, 'verify_vault_close: coin_id must be null')
  Assert.ok(vault_profile.vault_script === null, 'verify_vault_close: vault_script must be null')
  Assert.ok(vault_profile.vault_value === null, 'verify_vault_close: vault_value must be null')
  Assert.ok(vault_profile.vault_balance === 0, 'verify_vault_close: vault_balance must be zero')
  Assert.ok(vault_profile.vault_ratio === null, 'verify_vault_close: vault_ratio must be null')
}
