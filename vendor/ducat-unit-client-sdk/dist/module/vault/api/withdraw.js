import { create_change_out, create_vault_return, create_vault_spend_out, create_vault_spend_vin, get_contract_input, get_vault_input, get_vault_return_data } from '../../../module/vault/lib/index.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
import Schema from '../../../schema/index.js';
import TX from '../../../util/tx.js';
const VAULT_VIN_IDX = CONST.TXMAP.withdraw.vault_tx.vin.vault;
export function create_vault_withdraw_ctx(price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'w'
    };
}
export function create_vault_withdraw_psbt(vault_ctx) {
    const { change_amount, vault_balance, vault_utxo } = vault_ctx;
    const tx_quote = get_vault_withdraw_quote(vault_ctx);
    const vault_amount = vault_utxo.value - tx_quote.total_cost;
    const return_data = get_vault_return_data(vault_ctx, vault_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, vault_balance, vault_amount));
    pdata.addOutput(create_change_out(vault_ctx, change_amount));
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    return PSBT.encode(pdata);
}
export function create_vault_withdraw_req(vault_ctx, vault_psbt) {
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX);
    const schema = Schema.vault.req.withdraw_req;
    return schema.parse({ ...vault_ctx, vault_input, vault_psbt, vault_txhex, vault_txid });
}
export function get_vault_withdraw_quote(vault_config) {
    const { change_amount, tx_feerate } = vault_config;
    const total_size = CONST.TXSIZE.ACTION.VAULT_WITHDRAW;
    const tx_cost = total_size * tx_feerate;
    const total_cost = change_amount + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
export default {
    create_ctx: create_vault_withdraw_ctx,
    create_psbt: create_vault_withdraw_psbt,
    create_req: create_vault_withdraw_req,
    get_quote: get_vault_withdraw_quote
};
