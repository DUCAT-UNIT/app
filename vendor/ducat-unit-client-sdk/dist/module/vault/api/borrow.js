import { Assert } from '@vbyte/util';
import { get_txid } from '@vbyte/btc-dev/tx';
import { PSBT } from '@ducat-unit/core';
import { get_coin_total_value } from '@ducat-unit/core/lib';
import { PSBT_CONFIG, TXMAP } from '../../../const.js';
import { emit_debug, emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { create_issue_account_output, create_unit_change_output, create_unit_spend_input, create_sats_change_output, create_vault_connector_vout, create_vault_return_output, create_vault_output, finalize_cosign_inputs, create_unit_issue_runestone, create_vault_conn_input, finalize_spending_inputs, create_issue_change_output, verify_vault_request_psbt, verify_vault_action_rules, create_vault_ctx, create_vault_request, create_unit_account_input, create_vault_spend_input, validate_vault_borrow_config, validate_vault_borrow_request } from '../lib/index.js';
const ISSUE_UNIT_VOUT = TXMAP.UNIT_ISSUE.VOUT.UNIT;
const ISSUE_CONN_VOUT = TXMAP.UNIT_ISSUE.VOUT.CONN;
export function create_vault_borrow_ctx(vault_config) {
    validate_vault_borrow_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_borrow_psbt1(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.borrow.create_issue_psbt', { fund_input_count: vault_ctx.fund_inputs.length }, scope => {
        const { fund_inputs, issue_account, unit_postage } = vault_ctx;
        const fund_value = get_coin_total_value(fund_inputs);
        const conn_value = fund_value - unit_postage;
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_issue_account_output(vault_ctx));
        pdata.addOutput(create_issue_change_output(vault_ctx));
        pdata.addOutput(create_vault_connector_vout(vault_ctx, conn_value));
        pdata.addOutput(create_unit_issue_runestone(vault_ctx));
        pdata.addInput(create_unit_account_input(issue_account));
        for (const utxo of fund_inputs) {
            pdata.addInput(PSBT.create_psbt_input(utxo));
        }
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.borrow.psbt.issue.created', 'created vault borrow issue PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_borrow_psbt2(vault_ctx, issue_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.borrow.create_vault_psbt', { issue_psbt_length: typeof issue_psbt === 'string' ? issue_psbt.length : issue_psbt.length }, scope => {
        const { change_value, unit_balance, vault_balance } = vault_ctx;
        const issue_pdata = PSBT.parse_psbt(issue_psbt);
        const unit_utxo = PSBT.extract_utxo(issue_pdata, ISSUE_UNIT_VOUT);
        const conn_utxo = PSBT.extract_utxo(issue_pdata, ISSUE_CONN_VOUT);
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_unit_change_output(vault_ctx));
        pdata.addOutput(create_vault_output(vault_ctx, unit_balance, vault_balance));
        if (change_value > 0) {
            pdata.addOutput(create_sats_change_output(vault_ctx, change_value));
        }
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_unit_spend_input(unit_utxo));
        pdata.addInput(create_vault_spend_input(vault_ctx));
        pdata.addInput(create_vault_conn_input(vault_ctx, conn_utxo));
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.borrow.psbt.vault.created', 'created vault borrow vault PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_borrow_psbts(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.borrow.create_psbts', {}, scope => {
        const issue_psbt = create_vault_borrow_psbt1(vault_ctx);
        const vault_psbt = create_vault_borrow_psbt2(vault_ctx, issue_psbt);
        emit_debug(scope, 'vault.borrow.create_psbts.complete', {
            issue_psbt_length: issue_psbt.length,
            vault_psbt_length: vault_psbt.length
        });
        return [issue_psbt, vault_psbt];
    });
}
export function create_vault_borrow_request(vault_ctx, vault_psbts) {
    return with_observe_span(vault_ctx.observe, 'vault.borrow.create_request', { signed_psbt_count: vault_psbts.length }, scope => {
        const [signed_issue_psbt, signed_vault_psbt] = vault_psbts;
        Assert.exists(signed_issue_psbt, 'issue PSBT is undefined');
        Assert.exists(signed_vault_psbt, 'vault PSBT is undefined');
        const context = create_vault_request(vault_ctx);
        const issue_pdata = PSBT.parse_psbt(signed_issue_psbt);
        const vault_pdata = PSBT.parse_psbt(signed_vault_psbt);
        finalize_spending_inputs(issue_pdata);
        finalize_cosign_inputs(vault_pdata);
        verify_vault_request_psbt(issue_pdata, 0);
        verify_vault_request_psbt(vault_pdata, vault_ctx.txfee_rate, {
            ...vault_ctx.validation_options,
            asset_pdata: issue_pdata,
            observe: vault_ctx.observe
        });
        const issue_txid = get_txid(issue_pdata.hex);
        const vault_txid = get_txid(vault_pdata.hex);
        verify_vault_action_rules(vault_ctx, vault_txid);
        const issue_psbt = PSBT.encode_psbt(issue_pdata);
        const vault_psbt = PSBT.encode_psbt(vault_pdata);
        const request = { ...context, issue_psbt, issue_txid, vault_psbt, vault_txid };
        validate_vault_borrow_request(request);
        emit_info(scope, 'vault.borrow.request.created', 'created vault borrow guardian request', {
            issue_txid,
            vault_txid
        });
        return request;
    });
}
export var VaultBorrowAPI;
(function (VaultBorrowAPI) {
    VaultBorrowAPI.create_ctx = create_vault_borrow_ctx;
    VaultBorrowAPI.create_psbts = create_vault_borrow_psbts;
    VaultBorrowAPI.create_request = create_vault_borrow_request;
})(VaultBorrowAPI || (VaultBorrowAPI = {}));
