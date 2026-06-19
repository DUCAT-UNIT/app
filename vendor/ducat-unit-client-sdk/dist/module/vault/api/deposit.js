import { get_txid } from '@vbyte/btc-dev/tx';
import { PSBT } from '@ducat-unit/core';
import { emit_info, with_observe_span } from '../../../lib/observe/index.js';
import { create_sats_change_output, create_vault_return_output, create_vault_spend_input, create_vault_output, finalize_cosign_inputs, finalize_spending_inputs, verify_vault_request_psbt, verify_vault_action_rules, create_vault_ctx, validate_vault_deposit_config, create_vault_request, validate_vault_deposit_request } from '../lib/index.js';
export function create_vault_deposit_ctx(vault_config) {
    validate_vault_deposit_config(vault_config);
    return create_vault_ctx(vault_config);
}
export function create_vault_deposit_psbt(vault_ctx) {
    return with_observe_span(vault_ctx.observe, 'vault.deposit.create_psbt', { fund_input_count: vault_ctx.fund_inputs.length }, scope => {
        const { change_value, fund_inputs, unit_balance, vault_balance } = vault_ctx;
        const pdata = PSBT.create_psbt({ allowUnknownOutputs: true });
        pdata.addOutput(create_vault_output(vault_ctx, unit_balance, vault_balance));
        if (change_value > 0) {
            pdata.addOutput(create_sats_change_output(vault_ctx, change_value));
        }
        pdata.addOutput(create_vault_return_output(vault_ctx));
        pdata.addInput(create_vault_spend_input(vault_ctx));
        for (const utxo of fund_inputs) {
            pdata.addInput(PSBT.create_psbt_input(utxo));
        }
        const psbt = PSBT.encode_psbt(pdata);
        emit_info(scope, 'vault.deposit.psbt.created', 'created vault deposit PSBT', {
            psbt_length: psbt.length
        });
        return psbt;
    });
}
export function create_vault_deposit_request(vault_ctx, vault_psbt) {
    return with_observe_span(vault_ctx.observe, 'vault.deposit.create_request', { signed_psbt_length: vault_psbt.length }, scope => {
        const context = create_vault_request(vault_ctx);
        const vault_pdata = PSBT.parse_psbt(vault_psbt);
        finalize_spending_inputs(vault_pdata);
        finalize_cosign_inputs(vault_pdata);
        verify_vault_request_psbt(vault_pdata, vault_ctx.txfee_rate, { ...vault_ctx.validation_options, observe: vault_ctx.observe });
        const vault_txid = get_txid(vault_pdata.hex);
        verify_vault_action_rules(vault_ctx, vault_txid);
        vault_psbt = PSBT.encode_psbt(vault_pdata);
        const request = { ...context, vault_psbt, vault_txid };
        validate_vault_deposit_request(request);
        emit_info(scope, 'vault.deposit.request.created', 'created vault deposit guardian request', {
            vault_txid
        });
        return request;
    });
}
export var VaultDepositAPI;
(function (VaultDepositAPI) {
    VaultDepositAPI.create_ctx = create_vault_deposit_ctx;
    VaultDepositAPI.create_psbt = create_vault_deposit_psbt;
    VaultDepositAPI.create_request = create_vault_deposit_request;
})(VaultDepositAPI || (VaultDepositAPI = {}));
