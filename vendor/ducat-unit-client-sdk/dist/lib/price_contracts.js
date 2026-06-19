export function filter_price_contracts(price_contracts, commit_hashes) {
    return price_contracts.filter(c => commit_hashes.includes(c.commit_hash));
}
