import type { CoinUtxo } from '@ducat-unit/core';
import type { VaultFundsContext } from '../types/vault.js';
export declare const FUNDS_CTX: VaultFundsContext;
export declare function get_coin_size(coin: CoinUtxo): number;
export declare function get_coin_total_size(coin_utxos: CoinUtxo[]): number;
export declare function get_coin_ctx(coin_inputs: CoinUtxo[], txfee_rate: number): VaultFundsContext;
