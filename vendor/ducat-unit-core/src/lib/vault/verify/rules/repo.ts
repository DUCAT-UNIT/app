/**
 * @fileoverview Vault repo action verification.
 *
 * Repo is a (full) liquidation absorption flow: a liquidator absorbs the
 * debt of one or more underwater vaults that each become a
 * `LiquidVaultProfile` (the `targets`). `verify_vault_repo` validates
 * the liquidator's own transition and verifies each absorbed target via
 * `verify_vault_repo_liquidated`.
 */

import { Assert } from '@vbyte/util'

import { verify_encumbered_vault }   from '@/lib/vault/validate.js'
import { verify_vault_profile }      from '@/lib/verify/vault.js'
import { guard_members_equal }       from '../util.js'
import { eval_vault_repo_policy }    from '../policy.js'
import { compose_strict_policy }     from '../util.js'
import { verify_vault_repo_liquidated } from './liquidate.js'

import type {
  LiquidVaultProfile,
  ProtoProfile,
  VaultProfile
} from '@/types/index.js'

/**
 * Verify the STRICT requirements of a vault repo action (liquidator side).
 *
 * Strict (consensus-envelope) requirements enforced here:
 * - Both profiles structurally verify (trust boundary)
 * - At least one liquidated target, each validated end-to-end via
 *   `verify_vault_repo_liquidated` (full breach chain + terminal-record
 *   invariants). Closes Codex findings #2, #5, #6.
 * - Resulting vault must be encumbered (absorbed debt requires fresh price)
 * - Guard members, client pubkey, and root txid must remain unchanged
 *
 * The liquidator's collateral-increase, debt-increase, and post-state ratio
 * floor are POLICY checks — see `eval_vault_repo_policy`. The composite
 * `verify_vault_repo` runs strict then policy and throws on a policy flag.
 *
 * The previous (liquidator) vault may be either cleared or encumbered:
 * a debt-free vault is allowed to participate in liquidation flows.
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Liquidator's post-state vault profile
 * @param prev_profile  - Liquidator's pre-state vault profile
 * @param targets       - Absorbed liquidated targets ({liquid, prev}[])
 * @throws Error if any verification fails
 */
export function verify_vault_repo_strict (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile,
  targets       : Array<{ liquid : LiquidVaultProfile, prev : VaultProfile }>
) : void {
  // Trust-boundary verification (Findings #1, #8, #9).
  verify_vault_profile(vault_profile, proto_profile)
  verify_vault_profile(prev_profile,  proto_profile)

  // Each target must be a valid liquidated record (full breach chain).
  Assert.ok(
    targets.length > 0,
    'verify_vault_repo: at least one liquidated target must be provided'
  )
  for (const target of targets) {
    verify_vault_repo_liquidated(proto_profile, target.liquid, target.prev)
  }

  // Resulting vault must be encumbered: absorbed debt requires fresh
  // oracle price data on the post-state regardless of whether the
  // liquidator previously held debt.
  verify_encumbered_vault(vault_profile)

  // Guard members must remain unchanged.
  Assert.ok(
    guard_members_equal(vault_profile.guard_members, prev_profile.guard_members),
    'verify_vault_repo: guard members must remain unchanged'
  )

  // Client pubkey must remain unchanged.
  Assert.ok(
    vault_profile.client_pubkey === prev_profile.client_pubkey,
    'verify_vault_repo: client pubkey must remain unchanged'
  )

  // Root txid must remain unchanged (vault lineage).
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_repo: root_txid must remain unchanged'
  )
}

/**
 * Verify a vault repo action: strict structural/continuity checks plus the
 * economic policy (collateral/debt increase, ratio floor). Throws on the
 * first policy flag after all strict checks pass.
 */
export function verify_vault_repo (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile,
  targets       : Array<{ liquid : LiquidVaultProfile, prev : VaultProfile }>
) : void {
  compose_strict_policy(
    'verify_vault_repo',
    () => verify_vault_repo_strict(proto_profile, vault_profile, prev_profile, targets),
    () => eval_vault_repo_policy(proto_profile, vault_profile, prev_profile)
  )
}
