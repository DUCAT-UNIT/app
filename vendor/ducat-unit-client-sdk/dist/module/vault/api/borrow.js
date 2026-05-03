import { PSBT, TX } from '../../../util/index.js';
import { create_unit_output, create_unit_rune_data, get_account_input, get_contract_input, get_vault_input, calc_issuance_tx_cost, create_vault_return, create_vault_fund_conn_out, create_vault_spend_out, create_vault_fund_conn_vin, create_vault_spend_vin, get_vault_return_data, create_change_out, get_estimated_spend_size } from '../../../module/vault/lib/index.js';
import CONST from '../../../const.js';
import Schema from '../../../schema/index.js';
const ACCT_VIN_IDX = CONST.TXMAP.borrow.acct_tx.vin.acct;
const CONN_OUT_IDX = CONST.TXMAP.borrow.acct_tx.vout.conn;
const UNIT_OUT_IDX = CONST.TXMAP.borrow.acct_tx.vout.unit;
const VAULT_VIN_IDX = CONST.TXMAP.borrow.vault_tx.vin.vault;
const CONN_VIN_IDX = CONST.TXMAP.borrow.vault_tx.vin.conn;
export function create_vault_borrow_ctx(acct_profile, price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_account_input(acct_profile),
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'b'
    };
}
export function create_vault_borrow_psbt1(vault_ctx, sats_utxos) {
    const { acct_utxo, borrow_amount, unit_rune_id, unit_address, unit_postage } = vault_ctx;
    const conn_value = calc_connector_value(vault_ctx, sats_utxos);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(create_vault_fund_conn_out(vault_ctx, conn_value));
    pdata.addOutput(create_unit_output(unit_address, unit_postage));
    pdata.addOutput(create_unit_rune_data(unit_rune_id, borrow_amount, UNIT_OUT_IDX));
    pdata.addInput(PSBT.create.input(acct_utxo));
    for (const utxo of sats_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    return PSBT.encode(pdata);
}
export function create_vault_borrow_psbt2(vault_ctx, acct_psbt) {
    const acct_pdata = PSBT.parse(acct_psbt);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, CONN_OUT_IDX);
    const unit_balance = calc_unit_balance(vault_ctx);
    const vault_amount = calc_vault_amount(vault_ctx);
    const change_amt = calc_change_amount(vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, unit_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, unit_balance, vault_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    pdata.addInput(create_vault_fund_conn_vin(vault_ctx, conn_utxo));
    return PSBT.encode(pdata);
}
export function create_vault_borrow_req(vault_ctx, issue_psbt, vault_psbt) {
    const issue_txhex = PSBT.get.txhex(issue_psbt);
    const issue_txid = TX.get_txid(issue_txhex);
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(issue_psbt, { start_idx: ACCT_VIN_IDX + 1 });
    const connect_input = PSBT.extract.script_vin(vault_psbt, CONN_VIN_IDX);
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX);
    const schema = Schema.vault.req.borrow_req;
    return schema.parse({ ...vault_ctx, sats_inputs, connect_input, issue_psbt, issue_txhex, issue_txid, vault_input, vault_psbt, vault_txhex, vault_txid });
}
function calc_connector_value(vault_config, sats_utxos) {
    const { unit_postage, tx_feerate } = vault_config;
    const fund_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const issue_cost = calc_issuance_tx_cost(sats_utxos, unit_postage, tx_feerate);
    return fund_value - issue_cost;
}
function calc_unit_balance(vault_ctx) {
    const { borrow_amount, vault_balance } = vault_ctx;
    return vault_balance + borrow_amount;
}
function calc_vault_amount(vault_ctx) {
    const { deposit_amount, vault_utxo } = vault_ctx;
    return vault_utxo.value + deposit_amount;
}
function calc_change_amount(vault_config, conn_value) {
    const { deposit_amount, tx_feerate } = vault_config;
    const tx_size = CONST.TXSIZE.TX.VAULT_CONN;
    const tx_cost = tx_size * tx_feerate;
    return conn_value - (deposit_amount + tx_cost);
}
export function get_vault_borrow_quote(vault_config, fee_options) {
    const { deposit_amount, tx_feerate, unit_postage } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_BORROW + spend_size;
    const total_size = action_size + spend_size;
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + unit_postage + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
export function get_vault_borrow_change(vault_config, sats_utxos) {
    const conn_value = calc_connector_value(vault_config, sats_utxos);
    return calc_change_amount(vault_config, conn_value);
}
export default {
    create_ctx: create_vault_borrow_ctx,
    create_psbt1: create_vault_borrow_psbt1,
    create_psbt2: create_vault_borrow_psbt2,
    create_req: create_vault_borrow_req,
    get_quote: get_vault_borrow_quote,
    get_change: get_vault_borrow_change
};
