import type { PolicyFlag, ProtoTxData, PSBTData } from '../../../types/index.js';
export declare function compose_strict_policy(label: string, run_strict: () => void, run_policy: () => PolicyFlag[]): void;
export declare function parse_vault_tx_from_psbt(vault_psbt: string | Uint8Array | PSBTData): ProtoTxData;
export declare function guard_members_equal(a: string[], b: string[]): boolean;
