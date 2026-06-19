import { get_txid } from '@vbyte/btc-dev/tx';
import { Assert } from '@vbyte/util';
import { PSBT } from '@ducat-unit/core';
import { PSBT_CONFIG } from '../../../const.js';
import { emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { create_vault_return_output, create_vault_spend_input, create_vault_output, create_reserve_spend_output, finalize_spending_inputs, finalize_cosign_inputs, create_liquid_spend_vin, finalize_liquid_inputs, extract_guardian_sighashes, verify_vault_request_psbt, verify_vault_action_rules, create_vault_ctx, create_vault_request, create_liquid_vault_locked_output, validate_vault_trim_config, validate_vault_trim_request } from '../lib/index.js';
export function create_vault_trim_ctx(vault_config) {
    validate_vault_trim_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_trim_psbt(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.trim.create_psbt', { liquid_vault_count: vault_ctx.liquid_profiles.length }, scope => {
        const { liquid_profiles, reserve_balance, unit_balance, vault_balance, vault_terms } = vault_ctx;
        const reserve_value_min = vault_terms.reserve_sats_min;
        const liquid_profile = liquid_profiles.at(0);
        Assert.exists(liquid_profile, 'no liquid profile found');
        Assert.exists(liquid_profile.vault_value, 'liquid profile missing vault_value');
        const return_value_sats = liquid_profile.vault_value - liquid_profile.claimed_sats;
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_vault_output(vault_ctx, unit_balance, vault_balance));
        pdata.addOutput(create_liquid_vault_locked_output(liquid_profile, return_value_sats));
        if (reserve_balance >= reserve_value_min) {
            pdata.addOutput(create_reserve_spend_output(vault_ctx, reserve_balance));
        }
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_vault_spend_input(vault_ctx));
        pdata.addInput(create_liquid_spend_vin(liquid_profile));
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.trim.psbt.created', 'created vault trim PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_trim_request(vault_ctx, vault_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.trim.create_request', { signed_psbt_length: vault_psbt.length }, scope => {
        Assert.exists(vault_psbt, 'vault PSBT is undefined');
        const { txfee_rate } = vault_ctx;
        const context = create_vault_request(vault_ctx);
        const vault_pdata = PSBT.parse_psbt(vault_psbt);
        finalize_cosign_inputs(vault_pdata);
        finalize_liquid_inputs(vault_pdata);
        finalize_spending_inputs(vault_pdata);
        const sighashes = extract_guardian_sighashes(vault_pdata);
        verify_vault_request_psbt(vault_pdata, txfee_rate, { ...vault_ctx.validation_options, observe: vault_ctx.observe });
        const vault_txid = get_txid(vault_pdata.hex);
        verify_vault_action_rules(vault_ctx, vault_txid);
        vault_psbt = PSBT.encode_psbt(vault_pdata);
        const request = { ...context, sighashes, vault_psbt, vault_txid };
        validate_vault_trim_request(request);
        emit_info(scope, 'vault.trim.request.created', 'created vault trim guardian request', {
            vault_txid
        });
        return request;
    });
}
export var VaultTrimAPI;
(function (VaultTrimAPI) {
    VaultTrimAPI.create_ctx = create_vault_trim_ctx;
    VaultTrimAPI.create_psbt = create_vault_trim_psbt;
    VaultTrimAPI.create_request = create_vault_trim_request;
})(VaultTrimAPI || (VaultTrimAPI = {}));
