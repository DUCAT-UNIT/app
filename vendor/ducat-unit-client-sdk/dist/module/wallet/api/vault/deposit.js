import { Assert } from '../../../../util/index.js';
import { create_manifest } from '../../../../module/wallet/lib/util.js';
import { verify_vault_deposit_config } from '../../../../module/wallet/lib/verify.js';
import { verify_price_quote, verify_signed_utxo, verify_vault_profile } from '../../../../lib/verify.js';
import CONST from '../../../../const.js';
import VaultAPI from '../../../../module/vault/index.js';
function vault_deposit_ctx_api(client) {
    return (price_quote, vault_profile, vault_config) => {
        verify_price_quote(price_quote);
        verify_vault_profile(vault_profile);
        verify_vault_deposit_config(vault_config);
        const { deposit_amount, tx_feerate } = vault_config;
        const vault_pubkey = client.acct.vault.pubkey;
        Assert.ok(vault_pubkey === vault_profile.vault_pk, 'incoming vault pubkey does not belong to wallet');
        const config = {
            deposit_amount,
            sats_address: client.acct.sats.address,
            tx_feerate
        };
        return VaultAPI.deposit.create_ctx(price_quote, client.ctx, vault_profile, config);
    };
}
function vault_deposit_req_api(client) {
    const vin_vault_idx = CONST.TXMAP.deposit.vault_tx.vin.vault;
    const vin_fund_idx = vin_vault_idx + 1;
    return async (ctx, utxos) => {
        const { contract_id, network } = client;
        const utxo_inputs = utxos.map((_, idx) => vin_fund_idx + idx);
        const psbt_manifest = create_manifest([
            [client.acct.sats.address, utxo_inputs],
            [client.acct.vault.address, [vin_vault_idx]]
        ]);
        let psbt;
        psbt = VaultAPI.deposit.create_psbt(ctx, utxos);
        psbt = await client.sign.psbt(psbt, psbt_manifest);
        const req = VaultAPI.deposit.create_req(ctx, psbt);
        req.sats_inputs.forEach(verify_signed_utxo);
        return { ...req, contract_id, network };
    };
}
export default function (client) {
    return {
        ctx: vault_deposit_ctx_api(client),
        quote: VaultAPI.deposit.get_quote,
        req: vault_deposit_req_api(client)
    };
}
