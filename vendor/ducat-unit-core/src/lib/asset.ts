/**
 * @fileoverview Asset account/pool helpers — balances, filtering, and coin selection.
 */

import { Assert }         from '@vbyte/util/assert'
import { decode_coin_id } from './pointer.js'
import { RANDOM_SORT }    from './random.js'
import { DUST_LIMIT }     from '@/const.js'

import type {
  AssetAccount,
  AssetBalanceType,
  AssetPool,
  AssetProfile,
  CoinUtxo,
  ProtoProfile
} from '@/types/index.js'

/** Read active or reserve balance from an asset account by balance type. */
export function get_asset_balance (
  asset_account : AssetAccount,
  balance_type  : AssetBalanceType
) : number {
  // If the balance type is active,
  if (balance_type === 'active') {
    // Return the active balance.
    return asset_account.asset_balance
  }
  // If the balance type is reserve,
  if (balance_type === 'reserve') {
    // Return the reserve balance.
    return asset_account.asset_reserve
  }
  // Else, throw an error.
  throw new Error(`invalid balance type: ${balance_type}`)
}

/** Filter asset accounts by a specific asset id. */
export function filter_asset_accounts (
  asset_accts : AssetAccount[],
  asset_id    : string
) : AssetAccount[] {
  // Return a filtered array of asset accounts.
  return asset_accts.filter(account => account.asset_id === asset_id)
}

/** Select asset accounts that satisfy a target amount for an asset id. */
export function select_asset_accounts (
  asset_accts  : AssetAccount[],
  asset_id     : string,
  asset_amount : number,
  balance_type : AssetBalanceType = 'active'
) : AssetAccount[] {
  // Initialize the selected coins array.
  const selected : AssetAccount[] = []
  // Initialize the total amount.
  let asset_total = 0
  // Sort the coins randomly.
  asset_accts.sort(RANDOM_SORT)
  // For each coin,
  for (const account of asset_accts) {
    // If the asset id is not the desired asset, continue.
    if (account.asset_id !== asset_id) continue
    // If the coin value is less than the dust limit, continue.
    if (account.coin_value < DUST_LIMIT) continue
    // Get the balance for the asset account.
    const balance = get_asset_balance(account, balance_type)
    // If the balance is zero, continue.
    if (balance === 0)  continue
    // Add the coin to the selected coins array.
    selected.push(account)
    // Add the balance to the total amount.
    asset_total += balance
    // If the total amount is greater than 
    // or equal to the asset amount, break.
    if (asset_total >= asset_amount) break
  }
  // Assert that the total is greater than or equal to the amount.
  Assert.ok(asset_total >= asset_amount, `insufficient funds for asset: ${asset_total} < ${asset_amount}`)
  // Return the selected coins.
  return selected
}

/** Convert a stored asset account pointer into coin UTXO shape. */
export function get_asset_account_utxo (
  asset_account : AssetAccount
) : CoinUtxo {
  const { coin_id, coin_script, coin_value } = asset_account
  const pointer = decode_coin_id(coin_id)
  return {
    script_pk : coin_script,
    txid      : pointer.txid,
    value     : coin_value,
    vout      : pointer.vout
  }
}

/** Resolve an asset profile from protocol assets by asset id. */
export function get_asset_profile (
  proto_profile : ProtoProfile,
  asset_id      : string
) : AssetProfile {
  // Get the unit asset profile from the protocol profile.
  const asset_profile = proto_profile.proto_assets.find(e => e.id === asset_id)
  // Assert the unit asset profile exists.
  Assert.exists(asset_profile, `asset profile not found for id: ${asset_id}`)
  // Return the unit asset profile.
  return asset_profile
}

/** Aggregate pool metrics and UTXOs for one asset id across accounts. */
export function get_asset_pool (
  asset_id    : string,
  asset_accts : AssetAccount[]
) : AssetPool {
  // Initialize the coin utxos array.
  const coin_utxos : Array<CoinUtxo> = []
  // Initialize the pool values.
  let pool_value   = 0
    , pool_active  = 0
    , pool_reserve = 0
  // For each asset,
  for (const account of asset_accts) {
    // If the account is not the desired asset, continue.
    if (account.asset_id !== asset_id) continue
    // Add the balance to the total amount.
    pool_active  += account.asset_balance
    pool_reserve += account.asset_reserve
    pool_value   += account.coin_value
    // Add the coin to the pool coins array.
    coin_utxos.push(get_asset_account_utxo(account))
  }

  // Return the pool data.
  return { asset_id, coin_utxos, pool_active, pool_reserve, pool_value }
}
