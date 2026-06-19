import type { PSBTData, PSBTInput } from '@ducat-unit/core';
import type { SighashEntry } from '@ducat-unit/core';
interface PSBTTotals {
    txin_total: bigint;
    vout_total: bigint;
    fees_total: bigint;
}
export declare function get_input_code(input: PSBTInput): number | null;
export declare function calc_psbt_totals(pdata: PSBTData): PSBTTotals;
export declare function finalize_spending_inputs(pdata: PSBTData): void;
export declare function finalize_cosign_inputs(pdata: PSBTData): void;
export declare function finalize_liquid_inputs(pdata: PSBTData): void;
export declare function extract_guardian_sighashes(pdata: PSBTData): SighashEntry[];
export {};
