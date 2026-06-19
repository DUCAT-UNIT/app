import type { AssetAccount, CoinUtxo, PSBTInput } from '@ducat-unit/core';
export declare function create_unit_account_input(unit_account: AssetAccount): PSBTInput;
export declare function create_unit_spend_input(coin_utxo: CoinUtxo): PSBTInput;
