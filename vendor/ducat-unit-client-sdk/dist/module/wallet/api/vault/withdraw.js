import { Assert } from '../../../../util/index.js';
import { create_manifest } from '../../../../module/wallet/lib/util.js';
import { verify_vault_withdraw_config } from '../../../../module/wallet/lib/verify.js';
import { verify_price_quote, verify_vault_profile } from '../../../../lib/verify.js';
import CONST from '../../../../const.js';
import VaultAPI from '../../../../module/vault/index.js';
function vault_withdraw_ctx_api(client) {
    return (price_quote, vault_profile, vault_config) => {
        verify_price_quote(price_quote);
        verify_vault_profile(vault_profile);
        verify_vault_withdraw_config(vault_config);
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            change_amount: vault_config.change_amount,
            sats_address: client.acct.sats.address,
            tx_feerate: vault_config.tx_feerate
        };
        return VaultAPI.withdraw.create_ctx(price_quote, client.ctx, vault_profile, config);
    };
}
function vault_withdraw_req_api(client) {
    const vin_vault_idx = CONST.TXMAP.withdraw.vault_tx.vin.vault;
    return async (ctx) => {
        const { contract_id, network } = client;
        const vault_manifest = create_manifest([
            [client.acct.vault.address, [vin_vault_idx]]
        ]);
        let psbt;
        psbt = VaultAPI.withdraw.create_psbt(ctx);
        psbt = await client.sign.psbt(psbt, vault_manifest);
        const req = VaultAPI.withdraw.create_req(ctx, psbt);
        return { ...req, contract_id, network };
    };
}
export default function (client) {
    return {
        ctx: vault_withdraw_ctx_api(client),
        quote: VaultAPI.withdraw.get_quote,
        req: vault_withdraw_req_api(client)
    };
}
