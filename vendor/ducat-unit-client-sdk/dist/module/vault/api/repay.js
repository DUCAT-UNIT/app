import { Assert } from '@vbyte/util';
import { get_txid } from '@vbyte/btc-dev/tx';
import { PSBT } from '@ducat-unit/core';
import { emit_debug, emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { PSBT_CONFIG, TXMAP } from '../../../const.js';
import { get_asset_account_utxo } from '@ducat-unit/core/lib';
import { create_sats_change_output, create_vault_return_output, create_vault_spend_input, create_vault_output, finalize_cosign_inputs, create_vault_connector_vout, create_unit_burn_runestone, create_vault_conn_input, finalize_spending_inputs, create_unit_change_output, verify_vault_request_psbt, verify_vault_action_rules, create_vault_ctx, validate_vault_repay_config, create_vault_request, get_unit_asset_pool, get_vault_context_coin_value, validate_vault_repay_request } from '../../../module/vault/lib/index.js';
const UNIT_CONN_VOUT = TXMAP.UNIT_REPAY.VOUT.CONN;
export function create_vault_repay_ctx(vault_config) {
    validate_vault_repay_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_repay_psbt_1(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.repay.create_burn_psbt', {
        asset_input_count: vault_ctx.asset_inputs.length,
        fund_input_count: vault_ctx.fund_inputs.length
    }, scope => {
        const { asset_inputs, fund_inputs, action_postage, repay_amount } = vault_ctx;
        const unit_pool = get_unit_asset_pool(vault_ctx);
        Assert.ok(unit_pool.pool_active >= repay_amount, 'account balance is below the configured repay amount');
        const has_change = unit_pool.pool_active > repay_amount;
        if (has_change) {
            Assert.exists(action_postage, 'unit postage is required when there is change');
        }
        const fund_value = get_vault_context_coin_value(vault_ctx);
        const conn_value = fund_value - ((has_change) ? action_postage : 0);
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_vault_connector_vout(vault_ctx, conn_value));
        pdata.addOutput(create_unit_burn_runestone(vault_ctx, has_change));
        if (has_change) {
            pdata.addOutput(create_unit_change_output(vault_ctx));
        }
        for (const asset of asset_inputs) {
            pdata.addInput(PSBT.create_psbt_input(get_asset_account_utxo(asset)));
        }
        for (const utxo of fund_inputs) {
            pdata.addInput(PSBT.create_psbt_input(utxo));
        }
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.repay.psbt.burn.created', 'created vault repay burn PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_repay_psbt_2(vault_ctx, burn_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.repay.create_vault_psbt', { burn_psbt_length: burn_psbt.length }, scope => {
        const { change_value, unit_balance, vault_balance } = vault_ctx;
        const burn_pdata = PSBT.parse_psbt(burn_psbt);
        const conn_utxo = PSBT.extract_utxo(burn_pdata, UNIT_CONN_VOUT);
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_vault_output(vault_ctx, unit_balance, vault_balance));
        if (change_value > 0) {
            pdata.addOutput(create_sats_change_output(vault_ctx, change_value));
        }
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_vault_spend_input(vault_ctx));
        pdata.addInput(create_vault_conn_input(vault_ctx, conn_utxo));
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.repay.psbt.vault.created', 'created vault repay vault PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_repay_psbts(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.repay.create_psbts', {}, scope => {
        const burn_psbt = create_vault_repay_psbt_1(vault_ctx);
        const vault_psbt = create_vault_repay_psbt_2(vault_ctx, burn_psbt);
        emit_debug(scope, 'vault.repay.create_psbts.complete', {
            burn_psbt_length: burn_psbt.length,
            vault_psbt_length: vault_psbt.length
        });
        return [burn_psbt, vault_psbt];
    });
}
export function create_vault_repay_request(vault_ctx, vault_psbts) {
    return with_observe_span(vault_ctx.observe, 'vault.repay.create_request', { signed_psbt_count: vault_psbts.length }, scope => {
        const [signed_burn_psbt, signed_vault_psbt] = vault_psbts;
        Assert.exists(signed_burn_psbt, 'burn PSBT is undefined');
        Assert.exists(signed_vault_psbt, 'vault PSBT is undefined');
        const context = create_vault_request(vault_ctx);
        const burn_pdata = PSBT.parse_psbt(signed_burn_psbt);
        const vault_pdata = PSBT.parse_psbt(signed_vault_psbt);
        finalize_spending_inputs(burn_pdata);
        finalize_cosign_inputs(vault_pdata);
        verify_vault_request_psbt(burn_pdata, 0);
        verify_vault_request_psbt(vault_pdata, vault_ctx.txfee_rate, {
            ...vault_ctx.validation_options,
            asset_pdata: burn_pdata,
            observe: vault_ctx.observe
        });
        const burn_txid = get_txid(burn_pdata.hex);
        const vault_txid = get_txid(vault_pdata.hex);
        verify_vault_action_rules(vault_ctx, vault_txid);
        const burn_psbt = PSBT.encode_psbt(burn_pdata);
        const vault_psbt = PSBT.encode_psbt(vault_pdata);
        const request = { ...context, burn_psbt, burn_txid, vault_psbt, vault_txid };
        validate_vault_repay_request(request);
        emit_info(scope, 'vault.repay.request.created', 'created vault repay guardian request', {
            burn_txid,
            vault_txid
        });
        return request;
    });
}
export var VaultRepayAPI;
(function (VaultRepayAPI) {
    VaultRepayAPI.create_ctx = create_vault_repay_ctx;
    VaultRepayAPI.create_psbts = create_vault_repay_psbts;
    VaultRepayAPI.create_request = create_vault_repay_request;
})(VaultRepayAPI || (VaultRepayAPI = {}));
