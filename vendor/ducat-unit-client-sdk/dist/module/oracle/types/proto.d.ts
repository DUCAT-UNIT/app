import type { HostRecord, Literal, MintProfile, GroupContract, PointerContract, QuorumContract, ContractPointer, RecordPointer } from '../../../types/index.js';
export type GroupMap = Map<number, string[]>;
export type MintMap = Map<string, MintProfile>;
export type TermsCache = Map<string, Literal[] | null>;
export type TermsMap = Map<string, Literal[]>;
export interface GuardContract extends QuorumContract {
}
export interface OracleContract extends GroupContract {
}
export interface TermsContract extends PointerContract {
}
export interface ExchangeRecord extends HostRecord {
}
export interface GuardianRecord extends HostRecord {
}
export interface MasterContract {
    groups: {
        guard: ContractPointer;
        oracle: ContractPointer;
    };
    runes: {
        unit: RecordPointer;
    };
    terms: {
        repo: ContractPointer;
        vault: ContractPointer;
    };
    ver: number;
}
export interface ContractGroups {
    guard: GuardContract;
    oracle: OracleContract;
}
export interface ContractPointers {
    repo: TermsContract;
    vault: TermsContract;
}
export interface ContractRunes {
    unit: MintProfile;
}
export interface ContractCache {
    ctx?: MasterContract;
    id?: string;
    groups: Partial<ContractGroups>;
    points: Partial<ContractPointers>;
    runes: Partial<ContractRunes>;
    terms: TermsMap;
}
export interface ProtocolProfile {
    ctx: MasterContract;
    groups: ContractGroups;
    master_id: string;
    points: ContractPointers;
    runes: ContractRunes;
    terms: TermsMap;
}
