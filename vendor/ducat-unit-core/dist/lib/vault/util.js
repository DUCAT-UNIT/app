import { Assert } from '@vbyte/util';
import { SYMBOLS } from '../../const.js';
import { get_proto_member_records } from '../../lib/index.js';
const VAULT_ACTIONS_LIQUIDATING = new Set([
    'liquidate',
    'trim'
]);
export function is_vault_active(profile) {
    return profile.vault_value !== null
        && !VAULT_ACTIONS_LIQUIDATING.has(profile.vault_action);
}
export function is_above_liquidation_threshold(profile) {
    if (profile.unit_price === null || profile.thold_price === null) {
        return false;
    }
    return profile.unit_price <= profile.thold_price;
}
export function is_valid_unit_balance(unit_balance, vault_terms) {
    return unit_balance === 0 || unit_balance >= vault_terms.unit_balance_min;
}
export function resolve_guardian_pubkeys(proto_profile, guard_pubkeys) {
    const records = get_guardian_records(proto_profile);
    return guard_pubkeys.map(pk => {
        const record = records.find(m => m.pubkey === pk);
        Assert.exists(record, `guardian record not found for public key: ${pk}`);
        return record;
    });
}
export function resolve_guardian_indices(proto_profile, guard_indices) {
    const records = get_guardian_records(proto_profile);
    return guard_indices.map(idx => {
        const record = records.find(m => m.idx === idx);
        Assert.exists(record, `guardian record not found for index: ${idx}`);
        return record;
    });
}
export function get_guardian_records(proto_profile) {
    const guard_code = SYMBOLS.SIGNER.GUARDIAN;
    return get_proto_member_records(proto_profile, guard_code);
}
export function find_oracle_record_by_pubkey(proto_members, oracle_pubkey) {
    const member = proto_members.find(m => m.pubkey === oracle_pubkey);
    Assert.exists(member, `oracle record not found for public key: ${oracle_pubkey}`);
    return member;
}
export function find_oracle_record_by_idx(proto_members, oracle_index) {
    const member = proto_members.find(m => m.idx === oracle_index);
    Assert.exists(member, `oracle record not found for index: ${oracle_index}`);
    return member;
}
export function get_oracle_records(proto_profile) {
    const oracle_code = SYMBOLS.SIGNER.ORACLE;
    return get_proto_member_records(proto_profile, oracle_code);
}
