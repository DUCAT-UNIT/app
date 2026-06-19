/**
 * @fileoverview Vault transaction input builders for action, connector, asset, and liquidation paths.
 */

import { VAULT_SEQUENCE_VERSION, SYMBOLS } from '@/const.js'

import {
  get_coin_input,
  encode_sequence,
  get_vault_action_code
} from '@/lib/index.js'

import type {
  CoinInput,
  CoinUtxo,
  SequenceMetaData,
  VaultAction
} from '@/types/index.js'

/** Tag a transaction input with sequence metadata for protocol parsing. */
export function create_meta_input (
  seq_code : number,
  tx_input : CoinUtxo
) {
  // Create the sequence configuration.
  const config : SequenceMetaData = {
    code    : seq_code,
    type    : 'metadata',
    version : VAULT_SEQUENCE_VERSION
  }
  // Create the sequence.
  const sequence = encode_sequence(config)
  // Return the coin input.
  return get_coin_input({ ...tx_input, sequence })
}

/** Create metadata-tagged input for a vault action transition. */
export function create_vault_action_input (
  coin_utxo    : CoinUtxo,
  vault_action : VaultAction
) : CoinInput {
  // Get the code for the vault action.
  const code = get_vault_action_code(vault_action)
  // Create the tagged input.
  return create_meta_input(code, coin_utxo)
}

/** Create metadata-tagged connector input for chained vault operations. */
export function create_vault_connector_input (
  coin_utxo : CoinUtxo,
) : CoinInput {
  // Get the code for the vault connector.
  const code = SYMBOLS.CODE.INPUT.CONNECT
  // Create the tagged input.
  return create_meta_input(code, coin_utxo)
}

/** Create metadata-tagged input for unit-asset transfers. */
export function create_unit_asset_input (
  coin_utxo : CoinUtxo,
) : CoinInput {
  // Get the code for the unit asset.
  const code = SYMBOLS.CODE.ASSET.UNIT
  // Create the tagged input.
  return create_meta_input(code, coin_utxo)
}

/** Create metadata-tagged input for liquidation/repo vault spend path. */
export function create_liquid_vault_input (
  coin_utxo : CoinUtxo,
) : CoinInput {
  // Get the code for the liquid vault.
  const code = SYMBOLS.CODE.INPUT.LIQUID
  // Create the tagged input.
  return create_meta_input(code, coin_utxo)
}
