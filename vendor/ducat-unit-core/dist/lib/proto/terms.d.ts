import type { ProtoTermRecord, TermValue, VaultTerms } from '../../types/index.js';
export declare function filter_terms(entries: ProtoTermRecord[], group: number): ProtoTermRecord[];
export declare function find_term_value(entries: ProtoTermRecord[], key: number): TermValue | TermValue[] | undefined;
export declare function get_vault_terms(term_entries: ProtoTermRecord[]): VaultTerms;
