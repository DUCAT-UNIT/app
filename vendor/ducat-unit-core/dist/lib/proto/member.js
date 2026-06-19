import { unique } from '@vbyte/util';
export function get_proto_member_by_idx(proto_profile, member_idx, group_code) {
    const members = get_proto_member_records(proto_profile, group_code);
    return members.find(mbr => mbr.idx === member_idx);
}
export function get_proto_member_by_pubkey(proto_profile, member_pubkey, group_code) {
    const members = get_proto_member_records(proto_profile, group_code);
    return members.find(mbr => mbr.pubkey === member_pubkey);
}
export function get_proto_member_records(proto_profile, group_code) {
    return (group_code)
        ? proto_profile.proto_members.filter(mbr => mbr.group === group_code)
        : proto_profile.proto_members;
}
export function is_authorized_signer(proto_profile, pubkey, group_code) {
    return get_proto_member_by_pubkey(proto_profile, pubkey, group_code) !== undefined;
}
export function resolve_proto_member_pubkeys(proto_profile, member_pubkeys, group_code) {
    const members = get_proto_member_records(proto_profile, group_code);
    const pubkeys = unique(member_pubkeys);
    return members.filter(m => pubkeys.includes(m.pubkey));
}
export function resolve_proto_member_indices(proto_profile, member_ids, group_code) {
    const members = get_proto_member_records(proto_profile, group_code);
    const ids = unique(member_ids);
    return members.filter(m => ids.includes(m.idx));
}
