import { create_unit_output, create_unit_rune_data, calc_issuance_tx_cost, create_change_out, create_vault_open_conn_out, create_vault_open_conn_vin, create_vault_return, create_vault_spend_out, get_account_input, get_contract_input, get_vault_return_data, get_vault_token_vsize, get_estimated_spend_size } from '../../../module/vault/lib/index.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
import Schema from '../../../schema/index.js';
import TX from '../../../util/tx.js';
const ACCT_VIN_IDX = CONST.TXMAP.open.acct_tx.vin.acct;
const ACCT_OUT_IDX = CONST.TXMAP.open.acct_tx.vout.acct;
const CONN_OUT_IDX = CONST.TXMAP.open.acct_tx.vout.conn;
const UNIT_OUT_IDX = CONST.TXMAP.open.acct_tx.vout.unit;
const CONN_VIN_IDX = CONST.TXMAP.open.vault_tx.vin.conn;
export function create_vault_open_ctx(acct_profile, price_quote, proto_profile, req_config) {
    return {
        ...req_config,
        ...get_account_input(acct_profile),
        ...get_contract_input(proto_profile),
        vault_quote: price_quote,
        vault_action: 'o'
    };
}
export function create_vault_open_psbt1(vault_ctx, sats_utxos) {
    const { acct_utxo, borrow_amount, unit_address, unit_postage, unit_rune_id } = vault_ctx;
    const conn_value = calc_conn_amount(vault_ctx, sats_utxos);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(create_vault_open_conn_out(vault_ctx, conn_value));
    pdata.addOutput(create_unit_output(unit_address, unit_postage));
    pdata.addOutput(create_unit_rune_data(unit_rune_id, borrow_amount, UNIT_OUT_IDX));
    pdata.addInput(PSBT.create.input(acct_utxo));
    for (const utxo of sats_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
export function create_vault_open_psbt2(vault_ctx, acct_psbt) {
    const { borrow_amount, deposit_amount, token_address, token_postage } = vault_ctx;
    const acct_pdata = PSBT.parse(acct_psbt);
    const acct_utxo = PSBT.extract.utxo(acct_pdata, ACCT_OUT_IDX);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, CONN_OUT_IDX);
    const change_amt = calc_change_amount(vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, borrow_amount);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(PSBT.create.payout(token_postage, token_address));
    pdata.addOutput(create_vault_spend_out(vault_ctx, borrow_amount, deposit_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(PSBT.create.input(acct_utxo));
    pdata.addInput(create_vault_open_conn_vin(vault_ctx, conn_utxo));
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
export function create_vault_open_req(vault_ctx, issue_psbt, vault_psbt) {
    vault_psbt = PSBT.finalize.script_vin(vault_psbt, CONN_VIN_IDX);
    const issue_pdata = PSBT.decode(issue_psbt);
    const issue_txhex = PSBT.get.txhex(issue_psbt);
    const issue_txid = TX.get_txid(issue_txhex);
    const vault_pdata = PSBT.decode(vault_psbt);
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(issue_pdata, { start_idx: ACCT_VIN_IDX + 1 });
    const connect_input = PSBT.extract.script_vin(vault_pdata, CONN_VIN_IDX);
    const schema = Schema.vault.req.open_req;
    return schema.parse({ ...vault_ctx, connect_input, sats_inputs, issue_psbt, issue_txhex, issue_txid, vault_psbt, vault_txhex, vault_txid });
}
function calc_conn_amount(vault_config, sats_utxos) {
    const { unit_postage, tx_feerate } = vault_config;
    const fund_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const issue_cost = calc_issuance_tx_cost(sats_utxos, unit_postage, tx_feerate);
    return fund_value - issue_cost;
}
function calc_change_amount(vault_config, conn_value) {
    const { deposit_amount, token_postage, token_data, tx_feerate } = vault_config;
    const token_size = get_vault_token_vsize(token_data);
    const tx_size = CONST.TXSIZE.TX.VAULT_OPEN;
    const total_size = token_size + tx_size;
    const tx_cost = total_size * tx_feerate;
    return conn_value - (deposit_amount + token_postage + tx_cost);
}
export function get_vault_open_quote(vault_config, fee_options) {
    const { deposit_amount, unit_postage, token_postage, token_data, tx_feerate } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_OPEN;
    const token_size = get_vault_token_vsize(token_data);
    const total_size = action_size + spend_size + token_size;
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + unit_postage + token_postage + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
export function get_vault_open_change(vault_config, sats_utxos) {
    const conn_value = calc_conn_amount(vault_config, sats_utxos);
    return calc_change_amount(vault_config, conn_value);
}
export default {
    create_ctx: create_vault_open_ctx,
    create_psbt1: create_vault_open_psbt1,
    create_psbt2: create_vault_open_psbt2,
    create_req: create_vault_open_req,
    get_quote: get_vault_open_quote,
    get_change: get_vault_open_change
};
