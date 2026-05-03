import { Assert, TX } from '../../../util/index.js';
import { create_vault_fund_conn_out, create_vault_fund_conn_vin, create_liquid_spend_vin, create_vault_return, create_vault_spend_out, create_vault_spend_vin, get_contract_input, get_vault_input, get_vault_return_data, create_change_out, create_reserve_spend_out, get_liquidation_ctx, get_liquidation_quote, calc_liquidate_tx_cost, get_estimated_spend_size, create_vault_locked_spend_out, create_vault_cleared_spend_out, get_liquid_vault_return_data, get_liquid_profile } from '../../../module/vault/lib/index.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
import Schema from '../../../schema/index.js';
const VAULT_CON_IDX = CONST.TXMAP.repo.vault_tx.vin.conn;
const VAULT_VIN_IDX = CONST.TXMAP.repo.vault_tx.vin.vault;
const MIN_VAULT_BAL = CONST.MIN_VAULT_BAL;
export function create_vault_repo_ctx(price_quote, proto_profile, vault_profile, req_config) {
    return {
        ...req_config,
        ...get_contract_input(proto_profile),
        ...get_vault_input(vault_profile),
        repo_action: 'l',
        vault_quote: price_quote,
        vault_action: 'x'
    };
}
export function create_vault_repo_psbt1(liquid_ctx, vault_ctx, fund_utxos) {
    const { liquid_vaults, reserve_sats, return_unit, return_sats } = liquid_ctx;
    const vault_action = vault_ctx.repo_action;
    const conn_value = calc_connector_amt(liquid_ctx, vault_ctx, fund_utxos);
    const return_data = get_liquid_vault_return_data(liquid_ctx, vault_ctx);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    const guard_pubkey = vault_ctx.guard_pubkey;
    for (const [index, profile] of liquid_vaults.entries()) {
        const vault_pubkey = profile.vault_pk;
        const thold_hash = profile.rdata.thold_hash;
        if (return_unit > 0 && index === 0) {
            Assert.exists(thold_hash, 'thold_hash is undefined for partially liquidated vault');
            pdata.addOutput(create_vault_locked_spend_out(guard_pubkey, thold_hash, return_sats, vault_pubkey));
        }
        else {
            Assert.ok(profile.return_sats === MIN_VAULT_BAL, 'return sats must be equal to the minimum vault balance for fully liquidated vault');
            pdata.addOutput(create_vault_cleared_spend_out(guard_pubkey, MIN_VAULT_BAL, vault_pubkey));
        }
    }
    pdata.addOutput(create_vault_fund_conn_out(vault_ctx, conn_value));
    if (reserve_sats > 0) {
        pdata.addOutput(create_reserve_spend_out(liquid_ctx));
    }
    pdata.addOutput(create_vault_return({ ...return_data, vault_action }));
    for (const vault of liquid_vaults) {
        pdata.addInput(create_liquid_spend_vin(vault_ctx, vault));
    }
    for (const utxo of fund_utxos) {
        pdata.addInput(PSBT.create.input(utxo));
    }
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
export function create_vault_repo_psbt2(liquid_ctx, vault_ctx, liquid_psbt) {
    const { claimed_unit, vault_count } = liquid_ctx;
    const { vault_balance } = vault_ctx;
    const acct_pdata = PSBT.parse(liquid_psbt);
    const conn_utxo = PSBT.extract.utxo(acct_pdata, vault_count);
    const vault_amount = calc_vault_amt(liquid_ctx, vault_ctx);
    const unit_balance = claimed_unit + vault_balance;
    const change_amt = calc_change_amt(liquid_ctx, vault_ctx, conn_utxo.value);
    const return_data = get_vault_return_data(vault_ctx, unit_balance);
    const pdata = PSBT.create.psbt({ allowUnknownOutputs: true });
    pdata.addOutput(create_vault_spend_out(vault_ctx, unit_balance, vault_amount));
    if (change_amt > 0) {
        pdata.addOutput(create_change_out(vault_ctx, change_amt));
    }
    pdata.addOutput(create_vault_return(return_data));
    pdata.addInput(create_vault_spend_vin(vault_ctx));
    pdata.addInput(create_vault_fund_conn_vin(vault_ctx, conn_utxo));
    PSBT.assert.is_funded(pdata);
    return PSBT.encode(pdata);
}
export function create_vault_repo_req(liquid_ctx, vault_ctx, liquid_psbt, vault_psbt) {
    const liquid_txhex = PSBT.get.txhex(liquid_psbt);
    const liquid_txid = TX.get_txid(liquid_txhex);
    const repo_amount = liquid_ctx.claimed_unit;
    const vault_txhex = PSBT.get.txhex(vault_psbt);
    const vault_txid = TX.get_txid(vault_txhex);
    const liquid_inputs = extract_liquid_inputs(liquid_ctx, liquid_psbt);
    const sats_inputs = extract_funding_inputs(liquid_ctx, liquid_psbt);
    const connect_input = PSBT.extract.script_vin(vault_psbt, VAULT_CON_IDX);
    const vault_input = PSBT.extract.script_vin(vault_psbt, VAULT_VIN_IDX);
    const schema = Schema.vault.req.repo_req;
    return schema.parse({ ...vault_ctx, connect_input, liquid_inputs, liquid_psbt, liquid_txhex, liquid_txid, repo_amount, sats_inputs, vault_input, vault_psbt, vault_txhex, vault_txid });
}
function calc_connector_amt(liquid_ctx, vault_config, sats_utxos) {
    const { tx_feerate } = vault_config;
    const { claimed_sats, vault_count } = liquid_ctx;
    const funding_value = sats_utxos.reduce((prev, curr) => prev + curr.value, 0);
    const liquid_tx_cost = calc_liquidate_tx_cost(sats_utxos, tx_feerate, vault_count);
    return funding_value + claimed_sats - liquid_tx_cost;
}
function calc_vault_amt(liquid_ctx, vault_ctx) {
    const { claimed_sats } = liquid_ctx;
    const { deposit_amount, vault_utxo } = vault_ctx;
    return deposit_amount + claimed_sats + vault_utxo.value;
}
function calc_change_amt(liquid_ctx, vault_config, conn_value) {
    const { claimed_sats } = liquid_ctx;
    const { deposit_amount, tx_feerate } = vault_config;
    const base_size = CONST.TXSIZE.TX.VAULT_CONN;
    const tx_cost = base_size * tx_feerate;
    const deposit_total = deposit_amount + claimed_sats;
    return conn_value - (deposit_total + tx_cost);
}
function extract_liquid_inputs(liquid_ctx, liquid_psbt) {
    const { vault_count, liquid_vaults } = liquid_ctx;
    const liquid_inputs = [];
    for (let idx = 0; idx < vault_count; idx++) {
        const vin = PSBT.extract.hlock_vin(liquid_psbt, idx);
        const input = get_liquid_vault_input(liquid_vaults, vin);
        liquid_inputs.push(input);
    }
    return liquid_inputs;
}
function get_liquid_vault_input(vaults, utxo) {
    const utxo_pt = `${utxo.txid}:${utxo.vout}`;
    const vault = vaults.find(v => {
        const vault_pt = `${v.utxo.txid}:${v.utxo.vout}`;
        return utxo_pt === vault_pt;
    });
    Assert.exists(vault, 'vault not found for utxo ' + utxo_pt);
    return {
        repo_portion: vault.repo_portion,
        vault_pubkey: vault.vault_pk,
        ...utxo
    };
}
function extract_funding_inputs(liquid_ctx, liquid_psbt) {
    const opt = { start_idx: liquid_ctx.vault_count };
    return PSBT.extract.funding_vins(liquid_psbt, opt);
}
export function get_vault_repo_quote(vault_config, vault_count, fee_options) {
    const { deposit_amount, tx_feerate } = vault_config;
    Assert.ok(tx_feerate > 0, 'tx_feerate must be greater than 0');
    Assert.ok(vault_count > 0, 'vault_count must be greater than 0');
    const spend_size = get_estimated_spend_size(fee_options);
    const action_size = CONST.TXSIZE.ACTION.VAULT_LIQUID;
    const vault_size = CONST.TXSIZE.TXIO.LIQUID_VAULT;
    const total_size = action_size + spend_size + (vault_size * vault_count);
    const tx_cost = total_size * tx_feerate;
    const total_cost = deposit_amount + tx_cost;
    return { tx_vsize: total_size, tx_cost, total_cost };
}
export function get_vault_repo_change(liquid_ctx, vault_config, sats_utxos) {
    const conn_value = calc_connector_amt(liquid_ctx, vault_config, sats_utxos);
    return calc_change_amt(liquid_ctx, vault_config, conn_value);
}
export default {
    create_ctx: create_vault_repo_ctx,
    create_psbt1: create_vault_repo_psbt1,
    create_psbt2: create_vault_repo_psbt2,
    create_req: create_vault_repo_req,
    get_tx_quote: get_vault_repo_quote,
    get_change: get_vault_repo_change,
    liquidation: {
        get_ctx: get_liquidation_ctx,
        get_quote: get_liquidation_quote,
        get_profile: get_liquid_profile
    }
};
