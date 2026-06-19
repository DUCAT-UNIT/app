/**
 * @fileoverview Coin output/utxo/input type definitions and asset-entry shapes.
 */

/**
 * Represents a transaction output with its script and value.
 */
export interface CoinOutput {
  /** The output script pubkey (hex-encoded) */
  script_pk : string
  /** The output value in satoshis */
  value     : number
}

/**
 * Represents an unspent transaction output (UTXO).
 * Extends CoinOutput with transaction reference information.
 */
export interface CoinUtxo extends CoinOutput {
  /** The transaction ID containing this output (hex-encoded, 32 bytes) */
  txid : string
  /** The output index within the transaction */
  vout : number
}

/**
 * Represents a transaction input ready for signing/spending.
 * Extends CoinUtxo with sequence and witness data.
 */
export interface CoinInput extends CoinUtxo {
  /** The input sequence number (for timelocks and RBF) */
  sequence : number
  /** The witness stack elements (hex-encoded strings) */
  witness  : string[]
}

/**
 * Asset entry for coins holding multiple assets.
 * Tuple of [asset_id, { active balance, reserve balance }]
 */
export type AssetEntry = [string, { active: number; reserve: number }]

/**
 * Extended CoinUtxo with optional asset holdings.
 * Used for tracking coins that contain protocol assets.
 */
export interface CoinUtxoWithAssets extends CoinUtxo {
  /** Optional array of assets held in this coin */
  assets?: AssetEntry[]
}