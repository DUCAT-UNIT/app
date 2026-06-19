import { get_wallet_accounts } from '../lib/account.js';
import { get_psbt_manifest_api } from '../lib/manifest.js';
import { get_observe_context } from '../../../lib/observe/index.js';
import { fetch_assets_api, fetch_funds_api, fetch_vaults_api, } from '../lib/fetch.js';
import { sign_psbt_api, sign_batch_api } from '../lib/sign.js';
const DEFAULT_CONFIG = {
    asset_postage: 1_000,
    chain_network: 'regtest',
    txfee_rate: 1,
    txfee_reserve: 1_000,
};
export class ProtoWallet {
    constructor(accounts, connector, options) {
        const config = get_config(options);
        this._acct = get_wallet_accounts(accounts, config.chain_network);
        this._conf = config;
        this._conn = connector;
        this._observe = get_observe_context(options.observability, {
            module: 'wallet',
            network: config.chain_network
        });
    }
    get account() {
        return this._acct;
    }
    get config() {
        return this._conf;
    }
    get connector() {
        return this._conn;
    }
    get observe() {
        return this._observe;
    }
    get fetch() {
        return {
            assets: fetch_assets_api(this),
            funds: fetch_funds_api(this),
            manifest: get_psbt_manifest_api(this),
            vaults: fetch_vaults_api(this)
        };
    }
    get sign() {
        return {
            batch: sign_batch_api(this),
            coins: this.connector.sign.coins(this),
            psbt: sign_psbt_api(this)
        };
    }
}
function get_config(options) {
    const { asset_postage, chain_network, txfee_rate, txfee_reserve } = options;
    return {
        ...DEFAULT_CONFIG,
        ...(asset_postage !== undefined ? { asset_postage } : {}),
        ...(chain_network !== undefined ? { chain_network } : {}),
        ...(txfee_rate !== undefined ? { txfee_rate } : {}),
        ...(txfee_reserve !== undefined ? { txfee_reserve } : {})
    };
}
