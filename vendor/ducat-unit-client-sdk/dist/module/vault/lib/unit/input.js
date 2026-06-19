import { PSBT } from '@ducat-unit/core';
import { create_unit_asset_input, get_asset_account_utxo } from '@ducat-unit/core/lib';
export function create_unit_account_input(unit_account) {
    const utxo = get_asset_account_utxo(unit_account);
    const input = create_unit_asset_input(utxo);
    return PSBT.create_psbt_input(input);
}
export function create_unit_spend_input(coin_utxo) {
    const utxo = create_unit_asset_input(coin_utxo);
    return PSBT.create_psbt_input(utxo);
}
