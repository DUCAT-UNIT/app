import { TX } from '../../../util/index.js';
import { create_vault_return, create_vault_spend_out, create_vault_spend_vin, get_contract_input, get_vault_input, get_vault_return_data, create_change_out, get_estimated_spend_size, get_actual_spend_size } from '../../../module/vault/lib/index.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
import Schema from '../../../schema/index.js';
const VAULT_VIN_IDX = CONST.TXMAP.deposit.vault_tx.vin.vault;
export function create_vault_deposit_ctx(price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'd'
    };
}
export function create_vault_deposit_psbt(vault_ctx, sats_utxos) {
    const { deposit_amount, vault_balance, vault_utxo } = vault_ctx;
    const vault_amt = vault_utxo.value + deposit_amount;
    const change_amt = get_vault_deposit_change(vault_ctx, sats_utxos);
    const return_data = get_vault_return_data(vault_ctx, vault_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, vault_balance, vault_amt));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    for (const utxo of sats_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    return PSBT.encode(pdata);
}
export function create_vault_deposit_req(vault_ctx, vault_psbt) {
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(vault_psbt, { start_idx: VAULT_VIN_IDX + 1 });
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX);
    const schema = Schema.vault.req.deposit_req;
    return schema.parse({ ...vault_ctx, sats_inputs, vault_input, vault_psbt, vault_txhex, vault_txid });
}
export function get_vault_deposit_quote(vault_config, fee_options = {}) {
    const { deposit_amount, tx_feerate } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const tx_vsize = CONST.TXSIZE.ACTION.VAULT_DEPOSIT + spend_size;
    const tx_cost = tx_vsize * tx_feerate;
    const total_cost = deposit_amount + tx_cost;
    return { tx_vsize, tx_cost, total_cost };
}
function get_vault_deposit_change(vault_config, vin_utxos) {
    const { tx_feerate } = vault_config;
    const vin_value = vin_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const vin_vsize = get_actual_spend_size(vin_utxos);
    const tx_quote = get_vault_deposit_quote(vault_config);
    const vin_cost = vin_vsize * tx_feerate;
    return vin_value - (vin_cost + tx_quote.total_cost);
}
export default {
    create_ctx: create_vault_deposit_ctx,
    create_psbt: create_vault_deposit_psbt,
    create_req: create_vault_deposit_req,
    get_quote: get_vault_deposit_quote,
    get_change: get_vault_deposit_change
};
