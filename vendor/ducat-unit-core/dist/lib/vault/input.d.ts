import type { CoinInput, CoinUtxo, VaultAction } from '../../types/index.js';
export declare function create_meta_input(seq_code: number, tx_input: CoinUtxo): CoinInput;
export declare function create_vault_action_input(coin_utxo: CoinUtxo, vault_action: VaultAction): CoinInput;
export declare function create_vault_connector_input(coin_utxo: CoinUtxo): CoinInput;
export declare function create_unit_asset_input(coin_utxo: CoinUtxo): CoinInput;
export declare function create_liquid_vault_input(coin_utxo: CoinUtxo): CoinInput;
