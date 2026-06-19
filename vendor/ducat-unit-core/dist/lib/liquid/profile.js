import { Assert } from '@vbyte/util';
import { get_liquidation_quote, get_partial_liquidation_quote, get_vault_breach_contract } from '../../lib/index.js';
export function get_liquid_vault_profiles(liquid_config, vault_profiles) {
    const { proto_profile, breach_contracts, liquid_price } = liquid_config;
    const liquid_vaults = [];
    for (const vault_profile of vault_profiles) {
        const { unit_balance, vault_balance } = vault_profile;
        const breach = get_vault_breach_contract(proto_profile, breach_contracts, vault_profile);
        if (!breach)
            continue;
        const liquid_quote = get_liquidation_quote(proto_profile, vault_balance, unit_balance, liquid_price);
        liquid_vaults.push({
            ...vault_profile,
            ...liquid_quote,
            liquid_key: breach.thold_key,
            liquid_price
        });
    }
    return liquid_vaults;
}
export function get_liquid_vault_profile(liquid_config, vault_profile, recap_amount) {
    const { proto_profile, breach_contracts, liquid_price } = liquid_config;
    const { unit_balance, vault_balance } = vault_profile;
    const breach = get_vault_breach_contract(proto_profile, breach_contracts, vault_profile);
    Assert.exists(breach, `liquidation breach is missing from price contracts`);
    const liquid_quote = get_liquidation_quote(proto_profile, vault_balance, unit_balance, liquid_price);
    const base = {
        ...vault_profile,
        liquid_key: breach.thold_key,
        liquid_price
    };
    if (recap_amount) {
        const partial_quote = get_partial_liquidation_quote(proto_profile, liquid_quote, recap_amount, liquid_price);
        return { ...base, ...partial_quote };
    }
    else {
        return { ...base, ...liquid_quote };
    }
}
