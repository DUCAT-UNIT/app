import { ProtoWallet } from '../../../module/wallet/class/wallet.js';
const DUCAT_SNAP_ID = 'npm:@ducat-unit/snap';
function invoke_snap(provider, method, params = {}) {
    return provider.request({
        method: 'wallet_invokeSnap',
        params: { snapId: DUCAT_SNAP_ID, request: { method, params } }
    });
}
async function get_snap_accounts(provider) {
    const accounts = await invoke_snap(provider, 'btc_getAccounts');
    return {
        asset: { pubkey: accounts.asset.pubkey },
        funds: { pubkey: accounts.funds.pubkey, version: accounts.funds.version },
        vault: { pubkey: accounts.vault.pubkey }
    };
}
export async function create_snap_wallet(provider, network = 'regtest') {
    const accounts = await get_snap_accounts(provider);
    const connector = {
        fetch: {
            funds: (_wallet) => async () => {
                throw new Error('create_snap_wallet: fetch.funds not wired (Task 0.7 browser tier)');
            }
        },
        sign: {
            psbt: (_wallet) => async (psbt, vins = {}) => {
                const res = await invoke_snap(provider, 'btc_signPsbt', {
                    psbt,
                    signInputs: vins
                });
                return res.psbt;
            },
            coins: (_wallet) => async (psbt) => {
                const res = await invoke_snap(provider, 'btc_signPsbt', { psbt });
                return res.psbt;
            }
        }
    };
    return new ProtoWallet(accounts, connector, {
        asset_postage: 1_000,
        chain_network: network,
        txfee_rate: 1,
        txfee_reserve: 1_000
    });
}
