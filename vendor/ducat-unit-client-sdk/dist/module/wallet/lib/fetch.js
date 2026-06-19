import { DucatError } from '../../../lib/errors/index.js';
import { child_observe_context, emit_debug, emit_info } from '../../../lib/observe/index.js';
import { filter_asset_accounts, select_asset_accounts, select_coins } from '@ducat-unit/core/lib';
import { fetch_address_assets, fetch_pubkey_vaults } from '../../../lib/fetch/index.js';
export function fetch_assets_api(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'fetch.assets' });
    return async (validator_url, asset_id, asset_amount, balance_type) => {
        emit_info(observe, 'wallet.fetch.assets.start', 'fetching wallet asset accounts', {
            asset_amount,
            asset_id,
            validator_url
        });
        const address = client.account.asset.address;
        const response = await fetch_address_assets(validator_url, address);
        if (!response.ok)
            throw new DucatError(response.error, 'FETCH_ERROR');
        const filtered = filter_asset_accounts(response.data, asset_id);
        const assets = (asset_amount > 0)
            ? select_asset_accounts(filtered, asset_id, asset_amount, balance_type)
            : filtered;
        emit_debug(observe, 'wallet.fetch.assets.complete', {
            asset_amount,
            asset_id,
            result_count: assets.length,
            validator_url
        });
        return assets;
    };
}
export function fetch_funds_api(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'fetch.funds' });
    const fetch_funds = client.connector.fetch.funds(client);
    return async (funds_amount) => {
        emit_info(observe, 'wallet.fetch.funds.start', 'fetching wallet funding utxos', {
            funds_amount
        });
        let utxos = await fetch_funds();
        if (typeof funds_amount === 'number') {
            utxos = select_coins(utxos, funds_amount);
        }
        emit_debug(observe, 'wallet.fetch.funds.complete', {
            coin_count: utxos.length,
            selected_for: funds_amount
        });
        return utxos;
    };
}
export function fetch_vaults_api(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'fetch.vaults' });
    return async (validator_url) => {
        emit_info(observe, 'wallet.fetch.vaults.start', 'fetching wallet vault profiles', {
            validator_url
        });
        const pubkey = client.account.vault.pubkey;
        const response = await fetch_pubkey_vaults(validator_url, pubkey);
        if (!response.ok)
            throw new DucatError(response.error, 'FETCH_ERROR');
        emit_debug(observe, 'wallet.fetch.vaults.complete', {
            result_count: response.data.length,
            validator_url
        });
        return response.data;
    };
}
