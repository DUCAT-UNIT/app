import { get_vault_guardian_count, get_price_oracle_count, tabulate_reserve_balance, tabulate_unit_balance } from '../../lib/index.js';
export function create_vault_action_context(action_config) {
    const guardian_count = get_vault_guardian_count(action_config);
    const oracle_count = get_price_oracle_count(action_config);
    const liquid_count = action_config.liquid_profiles?.length ?? 0;
    const reserve_balance = tabulate_reserve_balance(action_config);
    const unit_balance = tabulate_unit_balance(action_config);
    return { guardian_count, liquid_count, oracle_count, reserve_balance, unit_balance };
}
