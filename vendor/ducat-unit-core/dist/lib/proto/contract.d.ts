import type { AnchorSignerEntry, AnchorData, ProtoMemberRecord, ProtoContractTemplate, AssetProfile, AnchorContract, ProtoProfile, ProtoTermRecord, AnchorTermEntry } from '../../types/index.js';
export type ProtoContractIdInput = Pick<ProtoProfile, 'anchor_id' | 'contract_height' | 'contract_index' | 'contract_txid'>;
export declare function get_anchor_id(anchor_height: number, anchor_index: number, anchor_txid: string): string;
export declare function get_proto_contract_id(input: ProtoContractIdInput): string;
export declare function create_proto_member_records(data: AnchorSignerEntry[]): ProtoMemberRecord[];
export declare function create_proto_term_records(data: AnchorTermEntry[]): ProtoTermRecord[];
export declare function create_proto_template(assets: AssetProfile[], contract: AnchorContract, contract_height: number, contract_index: number, contract_txid: string, chain_height?: number): ProtoContractTemplate;
export declare function create_proto_profile(anchor_data: AnchorData, proto_template: ProtoContractTemplate): ProtoProfile;
