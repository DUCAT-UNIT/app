import { Test } from '@vbyte/util';
import { SYMBOLS } from '../../const.js';
import * as SCHEMA from '../../schema/index.js';
export function filter_terms(entries, group) {
    return entries.filter(entry => entry.group === group);
}
export function find_term_value(entries, key) {
    const proto_term = entries.find(entry => entry.key === key);
    if (!Test.exists(proto_term))
        return undefined;
    return (proto_term.value.length === 1) ? proto_term.value[0] : proto_term.value;
}
export function get_vault_terms(term_entries) {
    const entries = filter_terms(term_entries, SYMBOLS.STORE.VAULT);
    const values = {
        liquidation_tax: find_term_value(entries, SYMBOLS.TERM.VAULT.LIQUIDATION_TAX),
        liquidation_thold: find_term_value(entries, SYMBOLS.TERM.VAULT.LIQUIDATION_THOLD),
        reserve_pubkey: find_term_value(entries, SYMBOLS.TERM.VAULT.RESERVE_PUBKEY),
        reserve_sats_min: find_term_value(entries, SYMBOLS.TERM.VAULT.RESERVE_VALUE_MIN),
        subsidy_increment: find_term_value(entries, SYMBOLS.TERM.VAULT.SUBSIDY_INCREMENT),
        subsidy_thold: find_term_value(entries, SYMBOLS.TERM.VAULT.SUBSIDY_THOLD),
        unit_asset_id: find_term_value(entries, SYMBOLS.TERM.VAULT.UNIT_ASSET_ID),
        unit_balance_min: find_term_value(entries, SYMBOLS.TERM.VAULT.UNIT_BALANCE_MIN),
        vault_ratio_min: find_term_value(entries, SYMBOLS.TERM.VAULT.VAULT_RATIO_MIN),
        vault_value_min: find_term_value(entries, SYMBOLS.TERM.VAULT.VAULT_VALUE_MIN),
    };
    return SCHEMA.terms.vault.parse(values);
}
