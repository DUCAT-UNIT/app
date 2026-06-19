import type { PSBTData } from '../types/index.js';
export declare function finalize_spending_inputs(pdata: PSBTData): void;
export declare function finalize_legacy_input(pdata: PSBTData, index: number): void;
export declare function finalize_p2wpkh_input(pdata: PSBTData, index: number): void;
export declare function finalize_p2tr_input(pdata: PSBTData, index: number): void;
