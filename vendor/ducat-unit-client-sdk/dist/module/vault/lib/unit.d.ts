import type { PSBTBaseOutput } from '../../../types/index.js';
export declare function get_unit_balance(balance_amt: number, repay_amount: number): number;
export declare function get_unit_change(input_amount: number, repay_amount: number): number;
export declare function create_unit_output(unit_address: string, unit_postage: number): PSBTBaseOutput;
export declare function create_unit_rune_data(rune_id: string, unit_amount: number, utxo_index: number): {
    amount: bigint;
    script: string;
};
