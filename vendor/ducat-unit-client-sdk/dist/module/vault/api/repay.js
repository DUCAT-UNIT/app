import { sum_rune_utxos } from '../../../lib/utxo.js';
import { Assert } from '../../../util/index.js';
import { create_unit_output, create_unit_rune_data, get_unit_balance, get_unit_change, create_vault_spend_vin, get_account_input, get_contract_input, get_vault_input, create_vault_return, create_vault_spend_out, create_vault_fund_conn_out, create_vault_fund_conn_vin, get_vault_return_data, calc_issuance_tx_cost, create_change_out, get_estimated_spend_size } from '../../../module/vault/lib/index.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
import Schema from '../../../schema/index.js';
import TX from '../../../util/tx.js';
const ACCT_VIN_IDX = CONST.TXMAP.repay.acct_tx.vin.acct;
const CONN_OUT_IDX = CONST.TXMAP.repay.acct_tx.vout.conn;
const UNIT_OUT_IDX = CONST.TXMAP.repay.acct_tx.vout.unit;
const VAULT_VIN_IDX = CONST.TXMAP.repay.vault_tx.vin.vault;
const CONN_VIN_IDX = CONST.TXMAP.repay.vault_tx.vin.conn;
export function create_vault_repay_ctx(acct_profile, price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_account_input(acct_profile),
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        vault_quote: price_quote,
        vault_action: 'r'
    };
}
export function create_vault_repay_psbt1(vault_ctx, sats_utxos, unit_utxos) {
    const { acct_utxo, repay_amount, unit_rune_id, unit_rune_lbl, unit_address, unit_postage } = vault_ctx;
    const fund_utxos = [...unit_utxos, ...sats_utxos];
    const conn_value = calc_connector_amt(vault_ctx, fund_utxos);
    const unit_value = sum_rune_utxos(unit_utxos, unit_rune_lbl);
    const unit_change = get_unit_change(unit_value, repay_amount);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(PSBT.create.output(acct_utxo));
    pdata.addOutput(create_vault_fund_conn_out(vault_ctx, conn_value));
    if (unit_change !== 0) {
        pdata.addOutput(create_unit_output(unit_address, unit_postage));
        pdata.addOutput(create_unit_rune_data(unit_rune_id, unit_change, UNIT_OUT_IDX));
    }
    pdata.addInput(PSBT.create.input(acct_utxo));
    for (const utxo of fund_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    return PSBT.encode(pdata);
}
export function create_vault_repay_psbt2(vault_ctx, acct_psbt) {
    const { repay_amount, vault_balance } = vault_ctx;
    const acct_pdata = PSBT.parse(acct_psbt);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, CONN_OUT_IDX);
    const vault_amount = calc_vault_amount(vault_ctx);
    Assert.ok(repay_amount <= vault_balance, 'over-repayment detected');
    const unit_balance = get_unit_balance(vault_balance, repay_amount);
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
export function create_vault_repay_req(vault_ctx, repay_psbt, vault_psbt) {
    const repay_pdata = PSBT.decode(repay_psbt);
    const repay_txhex = PSBT.get.txhex(repay_psbt);
    const repay_txid = TX.get_txid(repay_txhex);
    const vault_pdata = PSBT.decode(vault_psbt);
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const sats_inputs = PSBT.extract.funding_vins(repay_pdata, {
        start_idx: ACCT_VIN_IDX + 1, post_exclude: vault_ctx.unit_postage
    });
    const unit_inputs = PSBT.extract.funding_vins(repay_pdata, {
        start_idx: ACCT_VIN_IDX + 1, post_filter: vault_ctx.unit_postage
    });
    const vault_input = PSBT.extract.script_vin(vault_pdata, VAULT_VIN_IDX);
    const connect_input = PSBT.extract.script_vin(vault_pdata, CONN_VIN_IDX);
    const schema = Schema.vault.req.repay_req;
    return schema.parse({ ...vault_ctx, connect_input, sats_inputs, unit_inputs, vault_input, repay_psbt, repay_txhex, repay_txid, vault_psbt, vault_txhex, vault_txid });
}
function calc_connector_amt(vault_config, sats_utxos) {
    const { unit_postage, tx_feerate } = vault_config;
    const fund_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const issue_cost = calc_issuance_tx_cost(sats_utxos, unit_postage, tx_feerate);
    return fund_value - issue_cost;
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
export function get_vault_repay_quote(vault_config, fee_options) {
    const { deposit_amount, unit_postage, tx_feerate } = vault_config;
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_REPAY;
    const total_size = action_size + spend_size;
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + unit_postage + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
export function get_vault_repay_change(vault_config, sats_utxos) {
    const conn_value = calc_connector_amt(vault_config, sats_utxos);
    return calc_change_amount(vault_config, conn_value);
}
export default {
    create_ctx: create_vault_repay_ctx,
    create_psbt1: create_vault_repay_psbt1,
    create_psbt2: create_vault_repay_psbt2,
    create_req: create_vault_repay_req,
    get_quote: get_vault_repay_quote,
    get_change: get_vault_repay_change
};
