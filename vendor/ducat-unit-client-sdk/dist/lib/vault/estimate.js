import { emit_debug, validate_action_config, get_effective_vsize, get_observe_context, get_vault_action_tx_vsize, get_vault_action_sigops_count, get_vault_action_sigops_vsize, get_vault_action_postage, with_observe_span, create_vault_action_context, } from '../../lib/index.js';
export function create_vault_action_estimate(action_config) {
    const observe = get_observe_context(action_config.observability, {
        module: 'vault.estimate',
        vault_action: action_config.vault_action
    });
    return with_observe_span(observe, `vault.${action_config.vault_action}.estimate`, { vault_action: action_config.vault_action }, scope => {
        validate_action_config(action_config);
        const { txfee_rate, txfee_reserve = 0, deposit_amount = 0 } = action_config;
        const action_ctx = create_vault_action_context(action_config);
        const action_vsize = get_vault_action_tx_vsize(action_config, action_ctx);
        const action_sigops_count = get_vault_action_sigops_count(action_config);
        const action_sigops_vsize = get_vault_action_sigops_vsize(action_config);
        const action_effective_vsize = get_effective_vsize({
            tx_vsize: action_vsize,
            sigops_count: action_sigops_count
        });
        const action_fees = action_effective_vsize * txfee_rate;
        const action_postage = get_vault_action_postage(action_config);
        const action_value = deposit_amount + action_fees + action_postage + txfee_reserve;
        const estimate = {
            ...action_ctx,
            action_effective_vsize,
            action_fees,
            action_postage,
            action_sigops_vsize,
            action_value,
            action_vsize
        };
        emit_debug(scope, `vault.${action_config.vault_action}.estimate.complete`, {
            action_effective_vsize,
            action_fees,
            action_postage,
            action_vsize,
            guardian_count: estimate.guardian_count,
            oracle_count: estimate.oracle_count
        });
        return estimate;
    });
}
