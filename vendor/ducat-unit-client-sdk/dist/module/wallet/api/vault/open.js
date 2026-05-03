import { create_manifest } from '../../../../module/wallet/lib/util.js';
import { verify_vault_open_config } from '../../../../module/wallet/lib/verify.js';
import { verify_account_profile, verify_price_quote, verify_signed_utxo } from '../../../../lib/verify.js';
import CONST from '../../../../const.js';
import VaultAPI from '../../../../module/vault/index.js';
function vault_open_ctx_api(client) {
    return (acct_profile, price_quote, vault_config) => {
        verify_account_profile(acct_profile);
        verify_price_quote(price_quote);
        verify_vault_open_config(vault_config);
        const { borrow_amount, deposit_amount, tx_feerate, vault_label } = vault_config;
        const token_data = {
            rev: 0,
            tag: vault_label,
            ver: 1
        };
        const config = {
            borrow_amount,
            deposit_amount,
            sats_address: client.acct.sats.address,
            unit_address: client.acct.runes.address,
            unit_postage: client.config.postage.unit,
            token_address: client.acct.vault.address,
            token_postage: client.config.postage.vault,
            token_data,
            tx_feerate,
            vault_pubkey: client.acct.vault.pubkey
        };
        return VaultAPI.open.create_ctx(acct_profile, price_quote, client.ctx, config);
    };
}
function vault_open_req_api(client) {
    const vin_conn_idx = CONST.TXMAP.open.vault_tx.vin.conn;
    const vin_fund_idx = CONST.TXMAP.open.acct_tx.vin.acct + 1;
    return async (ctx, utxos, batch = false) => {
        const { contract_id, network } = client;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const utxo_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs]
        ]);
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_conn_idx]]
        ]);
        let psbt1, psbt2;
        if (batch) {
            psbt1 = VaultAPI.open.create_psbt1(ctx, utxos);
            psbt2 = VaultAPI.open.create_psbt2(ctx, psbt1);
            const batch_request = [[psbt1, utxo_manifest], [psbt2, vault_manifest]];
            const signed_psbts = await client.sign.batch(batch_request);
            psbt1 = signed_psbts[0];
            psbt2 = signed_psbts[1];
        }
        else {
            psbt1 = VaultAPI.open.create_psbt1(ctx, utxos);
            psbt1 = await client.sign.psbt(psbt1, utxo_manifest);
            psbt2 = VaultAPI.open.create_psbt2(ctx, psbt1);
            psbt2 = await client.sign.psbt(psbt2, vault_manifest);
        }
        const req = VaultAPI.open.create_req(ctx, psbt1, psbt2);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
export default function (client) {
    return {
        ctx: vault_open_ctx_api(client),
        quote: VaultAPI.open.get_quote,
        req: vault_open_req_api(client)
    };
}
