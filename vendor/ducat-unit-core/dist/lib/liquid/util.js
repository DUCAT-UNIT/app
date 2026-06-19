import { extract_vault_price_contracts, validate_breached_price_contract } from '../../lib/index.js';
export function get_vault_breach_contract(proto_profile, price_contracts, vault_profile) {
    const vault_contracts = extract_vault_price_contracts(proto_profile, vault_profile);
    const contract_ids = vault_contracts.map(c => c.contract_id);
    const selected = price_contracts
        .filter(c => contract_ids.includes(c.contract_id) && c.thold_key !== null)
        .sort((a, b) => b.thold_price - a.thold_price)
        .at(0);
    if (!selected)
        return null;
    validate_breached_price_contract(selected);
    return selected;
}
export function get_vault_liquidation_key(proto_profile, price_contracts, vault_profile) {
    const breach = get_vault_breach_contract(proto_profile, price_contracts, vault_profile);
    return breach?.thold_key ?? null;
}
export function select_liquid_vaults(liquid_vaults, recap_limit) {
    const sorted_vaults = liquid_vaults
        .filter(v => v.deficit_sats > 0)
        .sort((a, b) => {
        if (b.deficit_sats !== a.deficit_sats)
            return b.deficit_sats - a.deficit_sats;
        return a.root_txid.localeCompare(b.root_txid);
    });
    const selected_vaults = [];
    let recap_cost = 0;
    for (const vault_profile of sorted_vaults) {
        recap_cost += vault_profile.deficit_sats;
        selected_vaults.push(vault_profile);
        if (recap_limit && recap_cost >= recap_limit)
            break;
    }
    return selected_vaults;
}
export function get_recap_costs_total(liquid_vaults) {
    return liquid_vaults.reduce((prev, curr) => prev + curr.deficit_sats, 0);
}
