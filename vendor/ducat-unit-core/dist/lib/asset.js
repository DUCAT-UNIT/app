import { Assert } from '@vbyte/util/assert';
import { decode_coin_id } from './pointer.js';
import { RANDOM_SORT } from './random.js';
import { DUST_LIMIT } from '../const.js';
export function get_asset_balance(asset_account, balance_type) {
    if (balance_type === 'active') {
        return asset_account.asset_balance;
    }
    if (balance_type === 'reserve') {
        return asset_account.asset_reserve;
    }
    throw new Error(`invalid balance type: ${balance_type}`);
}
export function filter_asset_accounts(asset_accts, asset_id) {
    return asset_accts.filter(account => account.asset_id === asset_id);
}
export function select_asset_accounts(asset_accts, asset_id, asset_amount, balance_type = 'active') {
    const selected = [];
    let asset_total = 0;
    asset_accts.sort(RANDOM_SORT);
    for (const account of asset_accts) {
        if (account.asset_id !== asset_id)
            continue;
        if (account.coin_value < DUST_LIMIT)
            continue;
        const balance = get_asset_balance(account, balance_type);
        if (balance === 0)
            continue;
        selected.push(account);
        asset_total += balance;
        if (asset_total >= asset_amount)
            break;
    }
    Assert.ok(asset_total >= asset_amount, `insufficient funds for asset: ${asset_total} < ${asset_amount}`);
    return selected;
}
export function get_asset_account_utxo(asset_account) {
    const { coin_id, coin_script, coin_value } = asset_account;
    const pointer = decode_coin_id(coin_id);
    return {
        script_pk: coin_script,
        txid: pointer.txid,
        value: coin_value,
        vout: pointer.vout
    };
}
export function get_asset_profile(proto_profile, asset_id) {
    const asset_profile = proto_profile.proto_assets.find(e => e.id === asset_id);
    Assert.exists(asset_profile, `asset profile not found for id: ${asset_id}`);
    return asset_profile;
}
export function get_asset_pool(asset_id, asset_accts) {
    const coin_utxos = [];
    let pool_value = 0, pool_active = 0, pool_reserve = 0;
    for (const account of asset_accts) {
        if (account.asset_id !== asset_id)
            continue;
        pool_active += account.asset_balance;
        pool_reserve += account.asset_reserve;
        pool_value += account.coin_value;
        coin_utxos.push(get_asset_account_utxo(account));
    }
    return { asset_id, coin_utxos, pool_active, pool_reserve, pool_value };
}
