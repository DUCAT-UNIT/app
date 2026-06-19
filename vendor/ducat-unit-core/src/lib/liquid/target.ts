/**
 * @fileoverview Builders for the liquidated-target `LiquidVaultProfile` that
 * `verify_vault_repo` / `verify_vault_trim` validate. Indexers and co-signers
 * (validator-ts, guardian-ts) construct these from the on-chain liquidation
 * inputs; keeping the construction here is the single source of truth so the
 * repo (full-clear) and trim (partial) target shapes cannot drift between
 * services.
 *
 * In both cases `liquid_key` is the hash160 preimage revealed in the on-chain
 * liquidation witness; the verifier re-derives the authorizing breach from the
 * target's pre-liquidation committed price contracts + that key (Finding #4).
 * The quote is computed from the PRE-liquidation balances (get_liquidation_quote
 * requires positive claimed amounts); its values are not consensus-verified —
 * they exist to satisfy the LiquidVaultProfile type.
 */

import { Assert } from '@vbyte/util'

import { get_coin_id }              from '@/lib/pointer.js'
import { get_vault_terms }          from '@/lib/proto/terms.js'
import { get_liquidation_quote }    from '@/lib/liquid/quote.js'
import { extract_liquid_thold_key } from '@/lib/vault/txdata.js'
import { get_vault_profile_ratio }  from '@/lib/vault/profile.js'
import { DEFAULT_RETURN_DATA }      from '@/lib/vault/rdata.js'

import type {
  LiquidTxInput,
  LiquidVaultProfile,
  ProtoProfile,
  VaultProfile
} from '@/types/index.js'

/**
 * Build the liquidated target for a REPO (full liquidation): the vault is
 * cleared — `unit_balance` 0, `vault_ratio` null, price data wiped.
 *
 * @param proto_profile - Protocol profile (caller-verified)
 * @param liquid_txinput - The on-chain liquidation input (witness + utxo)
 * @param prev_profile  - The target's pre-liquidation vault profile
 * @param liquid_price  - The liquidator's locked oracle price
 */
export function build_repo_liquidated_target (
  proto_profile : ProtoProfile,
  liquid_txinput : LiquidTxInput,
  prev_profile  : VaultProfile,
  liquid_price  : number
) : LiquidVaultProfile {
  Assert.exists(liquid_txinput.liquid_utxo, 'liquidation input is missing its utxo')
  const liquid_utxo = liquid_txinput.liquid_utxo
  const vault_terms = get_vault_terms(proto_profile.proto_terms)
  const liquid_key  = extract_liquid_thold_key(liquid_txinput)
  const quote       = get_liquidation_quote(
    proto_profile, prev_profile.vault_balance, prev_profile.unit_balance, liquid_price
  )
  return {
    ...prev_profile,
    ...DEFAULT_RETURN_DATA(),
    ...quote,
    // Identity carried forward for consensus consistency.
    guard_members : prev_profile.guard_members,
    guard_pubkey  : prev_profile.guard_pubkey,
    client_pubkey : prev_profile.client_pubkey,
    vault_config  : prev_profile.vault_config,
    coin_id       : get_coin_id(liquid_utxo),
    contract_id   : proto_profile.contract_id,
    vault_action  : 'liquidate',
    unit_balance  : 0,
    vault_balance : liquid_utxo.value - vault_terms.vault_value_min,
    vault_ratio   : null,
    vault_script  : liquid_utxo.script_pk,
    vault_value   : liquid_utxo.value,
    liquid_key,
    liquid_price
  }
}

/**
 * Build the liquidated target for a TRIM (partial liquidation): the vault
 * RETAINS reduced debt (`unit_balance - trim_amount`, still > 0) and remains
 * encumbered (price data preserved, `vault_ratio` recomputed from the locked
 * price). A fully-cleared target must use the repo flow instead.
 *
 * @param proto_profile - Protocol profile (caller-verified)
 * @param liquid_txinput - The on-chain liquidation input (witness + utxo)
 * @param prev_profile  - The target's pre-liquidation vault profile
 * @param liquid_price  - The liquidator's locked oracle price
 * @param trim_amount   - The debt absorbed from the target (> 0)
 */
export function build_trim_liquidated_target (
  proto_profile : ProtoProfile,
  liquid_txinput : LiquidTxInput,
  prev_profile  : VaultProfile,
  liquid_price  : number,
  trim_amount   : number
) : LiquidVaultProfile {
  Assert.exists(liquid_txinput.liquid_utxo, 'liquidation input is missing its utxo')
  Assert.exists(prev_profile.unit_price, 'liquidated vault is missing its unit price')
  const liquid_utxo = liquid_txinput.liquid_utxo
  const vault_terms = get_vault_terms(proto_profile.proto_terms)
  const liquid_key  = extract_liquid_thold_key(liquid_txinput)
  const quote       = get_liquidation_quote(
    proto_profile, prev_profile.vault_balance, prev_profile.unit_balance, liquid_price
  )
  const target : LiquidVaultProfile = {
    ...prev_profile,
    ...quote,
    coin_id       : get_coin_id(liquid_utxo),
    contract_id   : proto_profile.contract_id,
    vault_action  : 'liquidate',
    unit_balance  : prev_profile.unit_balance - trim_amount,
    vault_balance : liquid_utxo.value - vault_terms.vault_value_min,
    vault_ratio   : null,
    vault_script  : liquid_utxo.script_pk,
    vault_value   : liquid_utxo.value,
    liquid_key,
    liquid_price
  }
  // Recompute the ratio from the locked price data (target remains encumbered).
  target.vault_ratio = get_vault_profile_ratio(proto_profile, target)
  return target
}
