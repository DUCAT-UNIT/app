import { Assert } from '../../../../util/index.js';
import { create_manifest } from '../../../../module/wallet/lib/util.js';
import { verify_vault_borrow_config } from '../../../../module/wallet/lib/verify.js';
import { verify_price_quote, verify_account_profile, verify_signed_utxo } from '../../../../lib/verify.js';
import CONST from '../../../../const.js';
import VaultAPI from '../../../../module/vault/index.js';
function vault_borrow_ctx_api(client) {
    return (acct_profile, price_quote, vault_profile, vault_config) => {
        verify_account_profile(acct_profile);
        verify_price_quote(price_quote);
        verify_vault_borrow_config(vault_config);
        const { borrow_amount, deposit_amount, tx_feerate } = vault_config;
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            borrow_amount,
            deposit_amount,
            tx_feerate,
            sats_address: client.acct.sats.address,
            unit_address: client.acct.runes.address,
            unit_postage: client.config.postage.unit,
        };
        return VaultAPI.borrow.create_ctx(acct_profile, price_quote, client.ctx, vault_profile, config);
    };
}
function vault_borrow_req_api(client) {
    const vin_conn_idx = CONST.TXMAP.borrow.vault_tx.vin.conn;
    const vin_vault_idx = CONST.TXMAP.borrow.vault_tx.vin.vault;
    const vin_fund_idx = CONST.TXMAP.borrow.acct_tx.vin.acct + 1;
    return async (ctx, utxos, batch = false) => {
        const { contract_id, network } = client;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const utxo_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs]
        ]);
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_vault_idx, vin_conn_idx]]
        ]);
        let psbt1, psbt2;
        if (batch) {
            psbt1 = VaultAPI.borrow.create_psbt1(ctx, utxos);
            psbt2 = VaultAPI.borrow.create_psbt2(ctx, psbt1);
            const batch_request = [[psbt1, utxo_manifest], [psbt2, vault_manifest]];
            const signed_psbts = await client.sign.batch(batch_request);
            psbt1 = signed_psbts[0];
            psbt2 = signed_psbts[1];
        }
        else {
            psbt1 = VaultAPI.borrow.create_psbt1(ctx, utxos);
            psbt1 = await client.sign.psbt(psbt1, utxo_manifest);
            psbt2 = VaultAPI.borrow.create_psbt2(ctx, psbt1);
            psbt2 = await client.sign.psbt(psbt2, vault_manifest);
        }
        const req = VaultAPI.borrow.create_req(ctx, psbt1, psbt2);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
export default function (client) {
    return {
        ctx: vault_borrow_ctx_api(client),
        quote: VaultAPI.borrow.get_quote,
        req: vault_borrow_req_api(client)
    };
}
