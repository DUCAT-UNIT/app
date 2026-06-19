import { get_txid } from '@vbyte/btc-dev/tx';
import { PSBT } from '@ducat-unit/core';
import { PSBT_CONFIG } from '../../../const.js';
import { emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { create_sats_change_output, create_vault_return_output, create_vault_spend_input, finalize_cosign_inputs, finalize_spending_inputs, verify_vault_request_psbt, verify_vault_action_rules, create_vault_ctx, create_vault_request, validate_vault_close_config, validate_vault_close_request } from '../lib/index.js';
export function create_vault_close_ctx(vault_config) {
    validate_vault_close_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_close_psbt(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.close.create_psbt', {}, scope => {
        const { change_value } = vault_ctx;
        const pdata = PSBT.create_psbt(PSBT_CONFIG);
        pdata.addOutput(create_sats_change_output(vault_ctx, change_value));
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_vault_spend_input(vault_ctx));
        PSBT.assert_is_funded(pdata);
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.close.psbt.created', 'created vault close PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_close_request(vault_ctx, vault_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.close.create_request', { signed_psbt_length: vault_psbt.length }, scope => {
        const context = create_vault_request(vault_ctx);
        const pdata = PSBT.parse_psbt(vault_psbt);
        finalize_spending_inputs(pdata);
        finalize_cosign_inputs(pdata);
        verify_vault_request_psbt(pdata, vault_ctx.txfee_rate, { ...vault_ctx.validation_options, observe: vault_ctx.observe });
        const vault_txid = get_txid(pdata.hex);
        verify_vault_action_rules(vault_ctx, vault_txid);
        vault_psbt = PSBT.encode_psbt(pdata);
        const request = { ...context, vault_psbt, vault_txid };
        validate_vault_close_request(request);
        emit_info(scope, 'vault.close.request.created', 'created vault close guardian request', {
            vault_txid
        });
        return request;
    });
}
export var VaultCloseAPI;
(function (VaultCloseAPI) {
    VaultCloseAPI.create_ctx = create_vault_close_ctx;
    VaultCloseAPI.create_psbt = create_vault_close_psbt;
    VaultCloseAPI.create_request = create_vault_close_request;
})(VaultCloseAPI || (VaultCloseAPI = {}));
