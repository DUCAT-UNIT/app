import type { PSBTData, PSBTInput, PSBTOutput, PSBTPrevouts, SequenceData } from '../types/index.js';
export declare function get_psbt_vin(psbt: string | Uint8Array | PSBTData): PSBTInput[];
export declare function get_psbt_vin_total(psbt: string | Uint8Array | PSBTData): bigint;
export declare function get_psbt_vout(psbt: string | Uint8Array | PSBTData): PSBTOutput[];
export declare function get_psbt_prevouts(psbt: string | Uint8Array | PSBTData): PSBTPrevouts;
export declare function get_psbt_input(psbt: string | Uint8Array | PSBTData, index: number): PSBTInput;
export declare function get_psbt_output(psbt: string | Uint8Array | PSBTData, index: number): PSBTOutput;
export declare function get_psbt_input_sequence(psbt: string | Uint8Array | PSBTData, index: number): SequenceData | null;
export declare function get_psbt_input_code(input: PSBTInput): number | null;
