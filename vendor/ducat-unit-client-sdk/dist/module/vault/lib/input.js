export function get_account_input(account) {
    const { acct_id, utxo } = account;
    return { acct_id, acct_utxo: utxo };
}
export function get_contract_input(profile) {
    const contract_id = profile.master_id;
    const guard_pubkey = profile.groups.guard.pub;
    const unit_rune_id = profile.runes.unit.rune_id;
    const unit_rune_lbl = profile.runes.unit.label;
    const proto_terms = profile.terms;
    return { guard_pubkey, contract_id: contract_id, proto_terms, unit_rune_id, unit_rune_lbl };
}
export function get_vault_input(profile) {
    return {
        vault_balance: profile.rdata.unit_balance,
        vault_pubkey: profile.vault_pk,
        vault_utxo: profile.utxo
    };
}
