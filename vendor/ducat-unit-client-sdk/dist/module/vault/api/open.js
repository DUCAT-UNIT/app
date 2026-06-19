import { Assert } from '@vbyte/util';
import { PSBT } from '@ducat-unit/core';
import { get_coin_total_value } from '@ducat-unit/core/lib';
import { get_txid } from '@vbyte/btc-dev/tx';
import { PSBT_CONFIG, TXMAP } from '../../../const.js';
import { emit_debug, emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { finalize_cosign_inputs, finalize_spending_inputs, create_unit_issue_runestone, create_issue_account_output, create_unit_change_output, create_unit_spend_input, create_sats_change_output, create_vault_commit_input, create_vault_return_output, create_vault_output, verify_vault_request_psbt, verify_vault_action_rules, validate_vault_open_config, create_vault_ctx, create_vault_request, create_unit_account_input, create_issue_change_output, create_vault_commit_vout, validate_vault_open_request } from '../lib/index.js';
const UNIT_XFER_VOUT = TXMAP.UNIT_ISSUE.VOUT.UNIT;
const UNIT_CONN_VOUT = TXMAP.UNIT_ISSUE.VOUT.CONN;
export function create_vault_open_ctx(vault_config) {
    validate_vault_open_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_open_psbt_1(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.open.create_issue_psbt', { fund_input_count: vault_ctx.fund_inputs.length }, scope => {
        const { fund_inputs, issue_account, unit_postage } = vault_ctx;
        const fund_value = get_coin_total_value(fund_inputs);
        const conn_value = fund_value - unit_postage;
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_issue_account_output(vault_ctx));
        pdata.addOutput(create_issue_change_output(vault_ctx));
        pdata.addOutput(create_vault_commit_vout(vault_ctx, conn_value));
        pdata.addOutput(create_unit_issue_runestone(vault_ctx));
        pdata.addInput(create_unit_account_input(issue_account));
        for (const utxo of fund_inputs) {
            pdata.addInput(PSBT.create_psbt_input(utxo));
        }
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.open.psbt.issue.created', 'created vault open issue PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_open_psbt_2(vault_ctx, issue_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.open.create_vault_psbt', { issue_psbt_length: typeof issue_psbt === 'string' ? issue_psbt.length : issue_psbt.length }, scope => {
        const { change_value, unit_balance, vault_balance } = vault_ctx;
        const issue_pdata = PSBT.parse_psbt(issue_psbt);
        const unit_utxo = PSBT.extract_utxo(issue_pdata, UNIT_XFER_VOUT);
        const conn_utxo = PSBT.extract_utxo(issue_pdata, UNIT_CONN_VOUT);
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_unit_change_output(vault_ctx));
        pdata.addOutput(create_vault_output(vault_ctx, unit_balance, vault_balance));
        pdata.addOutput(create_sats_change_output(vault_ctx, change_value));
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_unit_spend_input(unit_utxo));
        pdata.addInput(create_vault_commit_input(vault_ctx, conn_utxo));
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.open.psbt.vault.created', 'created vault open vault PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_open_psbt_pkg(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.open.create_psbts', {}, scope => {
        const issue_psbt = create_vault_open_psbt_1(vault_ctx);
        const vault_psbt = create_vault_open_psbt_2(vault_ctx, issue_psbt);
        emit_debug(scope, 'vault.open.create_psbts.complete', {
            issue_psbt_length: issue_psbt.length,
            vault_psbt_length: vault_psbt.length
        });
        return [issue_psbt, vault_psbt];
    });
}
export function create_vault_open_request(vault_ctx, signed_psbts) {
    return with_observe_span(vault_ctx.observe, 'vault.open.create_request', { signed_psbt_count: signed_psbts.length }, scope => {
        const [signed_issue_psbt, signed_vault_psbt] = signed_psbts;
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
        validate_vault_open_request(request);
        emit_info(scope, 'vault.open.request.created', 'created vault open guardian request', {
            issue_txid,
            vault_txid
        });
        return request;
    });
}
export var VaultOpenAPI;
(function (VaultOpenAPI) {
    VaultOpenAPI.create_ctx = create_vault_open_ctx;
    VaultOpenAPI.create_psbts = create_vault_open_psbt_pkg;
    VaultOpenAPI.create_request = create_vault_open_request;
})(VaultOpenAPI || (VaultOpenAPI = {}));
