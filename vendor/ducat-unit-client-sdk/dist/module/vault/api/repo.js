import { get_txid } from '@vbyte/btc-dev/tx';
import { Assert } from '@vbyte/util';
import { PSBT } from '@ducat-unit/core';
import { emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { PSBT_CONFIG, DUST_LIMIT } from '../../../const.js';
import { create_liquid_vault_cleared_output, create_sats_change_output, create_vault_return_output, create_vault_spend_input, create_vault_output, create_reserve_spend_output, finalize_spending_inputs, finalize_cosign_inputs, create_liquid_spend_vin, verify_vault_request_psbt, verify_vault_action_rules, create_vault_ctx, validate_vault_repo_config, create_vault_request, validate_vault_repo_request, finalize_liquid_inputs, extract_guardian_sighashes } from '../lib/index.js';
export function create_vault_repo_ctx(vault_config) {
    validate_vault_repo_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_repo_psbt(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.repo.create_psbt', {
        fund_input_count: vault_ctx.fund_inputs.length,
        liquid_vault_count: vault_ctx.liquid_profiles.length
    }, scope => {
        const { fund_inputs, change_value, liquid_profiles, reserve_balance, vault_terms, unit_balance, vault_balance } = vault_ctx;
        const reserve_value_min = vault_terms.reserve_sats_min;
        const vault_value_min = vault_terms.vault_value_min;
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_vault_output(vault_ctx, unit_balance, vault_balance));
        for (const vault_profile of liquid_profiles) {
            pdata.addOutput(create_liquid_vault_cleared_output(vault_profile, vault_value_min));
        }
        if (change_value >= DUST_LIMIT) {
            pdata.addOutput(create_sats_change_output(vault_ctx, change_value));
        }
        if (reserve_balance >= reserve_value_min) {
            pdata.addOutput(create_reserve_spend_output(vault_ctx, reserve_balance));
        }
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_vault_spend_input(vault_ctx));
        for (const vault of liquid_profiles) {
            pdata.addInput(create_liquid_spend_vin(vault));
        }
        for (const utxo of fund_inputs) {
            pdata.addInput(PSBT.create_psbt_input(utxo));
        }
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.repo.psbt.created', 'created vault repo PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_repo_request(vault_ctx, vault_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.repo.create_request', { signed_psbt_length: vault_psbt.length }, scope => {
        Assert.exists(vault_psbt, 'vault PSBT is undefined');
        const context = create_vault_request(vault_ctx);
        const vault_pdata = PSBT.parse_psbt(vault_psbt);
        finalize_cosign_inputs(vault_pdata);
        finalize_liquid_inputs(vault_pdata);
        finalize_spending_inputs(vault_pdata);
        const sighashes = extract_guardian_sighashes(vault_pdata);
        verify_vault_request_psbt(vault_pdata, vault_ctx.txfee_rate, { ...vault_ctx.validation_options, observe: vault_ctx.observe });
        const vault_txid = get_txid(vault_pdata.hex);
        verify_vault_action_rules(vault_ctx, vault_txid);
        vault_psbt = PSBT.encode_psbt(vault_pdata);
        const request = { ...context, sighashes, vault_psbt, vault_txid };
        validate_vault_repo_request(request);
        emit_info(scope, 'vault.repo.request.created', 'created vault repo guardian request', {
            vault_txid
        });
        return request;
    });
}
export var VaultRepoAPI;
(function (VaultRepoAPI) {
    VaultRepoAPI.create_ctx = create_vault_repo_ctx;
    VaultRepoAPI.create_psbt = create_vault_repo_psbt;
    VaultRepoAPI.create_request = create_vault_repo_request;
})(VaultRepoAPI || (VaultRepoAPI = {}));
