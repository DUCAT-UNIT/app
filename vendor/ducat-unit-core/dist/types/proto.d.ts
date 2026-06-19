import type { AnchorData, TermValue } from './anchor.js';
import type { AssetProfile } from './asset.js';
export interface ProtoMemberRecord {
    group: number;
    idx: number;
    pubkey: string;
}
export interface ProtoTermRecord {
    group: number;
    key: number;
    value: TermValue[];
}
export interface ProtoContractTemplate {
    contract_height: number;
    contract_index: number;
    contract_txid: string;
    chain_height: number;
    proto_assets: AssetProfile[];
    proto_members: ProtoMemberRecord[];
    proto_terms: ProtoTermRecord[];
}
export interface ProtoContractData extends ProtoContractTemplate {
    contract_id: string;
}
export interface ProtoProfile extends AnchorData, ProtoContractData {
}
