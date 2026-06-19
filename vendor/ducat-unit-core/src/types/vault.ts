/**
 * @fileoverview Vault action, config, return-data, and profile type definitions.
 */

import type { PriceCommitData } from './price.js'

/**
 * Vault operations that can be performed.
 * - open: Create new vault with collateral
 * - close: Close vault and return collateral
 * - borrow: Borrow UNIT tokens against collateral
 * - repay: Repay borrowed UNIT tokens
 * - deposit: Add collateral to vault
 * - withdraw: Remove excess collateral
 * - repo: Reposition vault parameters
 * - trim: Partial liquidation of underwater vault
 * - liquidate: Full liquidation of underwater vault
 */
export type VaultAction = 'open' | 'close' | 'borrow' | 'repay' | 'repo' | 'withdraw' | 'deposit' | 'trim' | 'liquidate'

/**
 * Data embedded in a vault commit inscription.
 */
export interface VaultConfigPayload {
  /** User-defined label for the vault */
  lbl : string
}

/**
 * Parsed vault configuration from commit data.
 */
export interface VaultConfigData {
  /** Human-readable label for the vault */
  label : string
}

/**
 * Data stored in the vault's OP_RETURN output.
 * Tracks borrowed amounts and price commitments.
 */
export interface VaultReturnData {
  /** Vault guardians authorized for this vault */
  guard_members   : string[]
  /** Price commitments from oracles (empty if cleared) */
  price_commits   : PriceCommitData[]
  /** Timestamp when prices were locked (null if cleared) */
  price_stamp     : number | null
  /** Amount of UNIT tokens borrowed */
  unit_balance    : number
  /** Current BTC/USD price at lock time (null if cleared) */
  unit_price      : number | null
  /** Liquidation threshold price (null if cleared) */
  thold_price     : number | null
}

/**
 * Sequence data encoded in the vault input's sequence field.
 */
export interface VaultSequenceData {
  /** The vault action being performed */
  vault_action  : VaultAction
  /** Protocol version for the vault operation */
  vault_version : number
}

/**
 * Return data for a vault with active debt (locked state).
 * All price fields are required (non-null).
 */
export interface EncumberedVaultReturnData extends VaultReturnData {
  price_stamp : number
  unit_price  : number
  thold_price : number
}

/**
 * Return data for a vault without debt (cleared state).
 * All price fields are null.
 */
export interface ClearedVaultReturnData extends VaultReturnData {
  price_stamp : null
  unit_price  : null
  thold_price : null
}

/**
 * Optional configuration for vault profile creation.
 */
export interface VaultProfileConfig {
  /** The original vault creation transaction ID */
  root_txid?    : string
  /** User configuration data */
  vault_config? : VaultConfigData | null
}

/**
 * Complete vault profile containing all state information.
 * Combines return data, sequence data, and authorization info.
 */
export interface VaultProfile extends VaultReturnData, VaultSequenceData {
  /** Current coin ID (outpoint) of the vault UTXO (null once closed) */
  coin_id        : string | null
  /** Client's pubkey for authorization */
  client_pubkey  : string
  /** Protocol contract identifier */
  contract_id    : string
  /** Primary guard pubkey for cosigning */
  guard_pubkey   : string
  /** Original vault creation transaction ID */
  root_txid      : string
  /** Current vault balance in satoshis */
  vault_balance  : number
  /** User-defined configuration */
  vault_config   : VaultConfigData | null
  /** Current collateralization ratio (null if no debt) */
  vault_ratio    : number | null
  /** Current vault output script (hex-encoded), null once closed */
  vault_script   : string | null
  /** Current total vault value in satoshis, null once closed */
  vault_value    : number | null
}

/**
 * Block metadata attached to indexed protocol records.
 */
export interface BlockMetaData {
  /** Block height where the record was indexed */
  block_height : number
  /** Block timestamp (Unix epoch seconds) */
  block_stamp  : number
}

/**
 * Vault profile shape returned by history endpoints.
 */
export type VaultHistoryProfile = VaultProfile & BlockMetaData
