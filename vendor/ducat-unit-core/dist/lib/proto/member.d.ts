import type { ProtoMemberRecord, ProtoProfile } from '../../types/index.js';
export declare function get_proto_member_by_idx(proto_profile: ProtoProfile, member_idx: number, group_code?: number): ProtoMemberRecord | undefined;
export declare function get_proto_member_by_pubkey(proto_profile: ProtoProfile, member_pubkey: string, group_code?: number): ProtoMemberRecord | undefined;
export declare function get_proto_member_records(proto_profile: ProtoProfile, group_code?: number): ProtoMemberRecord[];
export declare function is_authorized_signer(proto_profile: ProtoProfile, pubkey: string, group_code?: number): boolean;
export declare function resolve_proto_member_pubkeys(proto_profile: ProtoProfile, member_pubkeys: string[], group_code?: number): ProtoMemberRecord[];
export declare function resolve_proto_member_indices(proto_profile: ProtoProfile, member_ids: number[], group_code?: number): ProtoMemberRecord[];
