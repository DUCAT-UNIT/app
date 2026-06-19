import type { WitnessData } from '@vbyte/btc-dev';
import type { ProtoTxData, WitnessCommit } from '../types/index.js';
export declare function get_commit_ref(commit_id: string): string;
export declare function find_witness_commit(commits: WitnessCommit[], code: number): WitnessCommit | null;
export declare function parse_witness_commits(txdata: ProtoTxData): WitnessCommit[];
export declare function parse_author_pubkey(script: string): string;
export declare function verify_witness_payload(witness: string[] | WitnessData): string | null;
