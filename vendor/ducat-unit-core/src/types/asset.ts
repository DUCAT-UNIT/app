/**
 * @fileoverview Asset account, pool, profile, and transfer-config type definitions.
 */

import type { CoinUtxo } from './coin.js'

/**
 * Type of asset balance to query or operate on.
 * - 'active': Available balance for spending/transfers
 * - 'reserve': Locked balance (e.g., in vault collateral)
 */
export type AssetBalanceType = 'active' | 'reserve'

/**
 * Represents an asset balance held in a specific UTXO.
 * Tracks both active and reserve balances for the asset.
 */
export interface AssetAccount {
  /** The asset identifier (e.g., '850000:102' for UNIT token) */
  asset_id      : string
  /** Available balance that can be spent */
  asset_balance : number
  /** Locked balance reserved for operations */
  asset_reserve : number
  /** The coin ID (outpoint format: txid:vout) */
  coin_id       : string
  /** The script pubkey of the UTXO (hex-encoded) */
  coin_script   : string
  /** The satoshi value of the UTXO */
  coin_value    : number
}

/**
 * Aggregated view of all accounts for a specific asset type.
 * Provides totals for planning and display purposes.
 */
export interface AssetPool {
  /** The asset identifier */
  asset_id     : string
  /** All UTXOs containing this asset */
  coin_utxos   : CoinUtxo[]
  /** Total active balance across all accounts */
  pool_active  : number
  /** Total reserve balance across all accounts */
  pool_reserve : number
  /** Total satoshi value of all UTXOs */
  pool_value   : number
}

/**
 * Metadata profile for an asset type defined in the protocol.
 */
export interface AssetProfile {
  /** Divisibility (decimal places, e.g., 4 means 10000 units = 1.0000) */
  div    : number
  /** Unique asset identifier (format: block_height:tx_index) */
  id     : string
  /** Human-readable name */
  label  : string
  /** Short ticker symbol (e.g., 'UNIT', 'DUCAT') */
  symbol : string
  /** Total supply as string (to support large numbers) */
  supply : string
}

/**
 * Configuration for transferring assets between outputs.
 */
export interface AssetTransferConfig {
  /** The asset to transfer */
  asset_id : string
  /** Amount to transfer (supports bigint for large values) */
  amount   : number | bigint
  /** Target output index in the transaction */
  output   : number
}
