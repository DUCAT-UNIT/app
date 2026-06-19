import type { PSBTData, PSBTFullInput, PSBTFullOutput, PSBTInput, PSBTOutput, PSBTPrevouts } from '../types/index.js';
export declare function assert_psbt_output(psbt_output: PSBTOutput): asserts psbt_output is PSBTFullOutput;
export declare function assert_psbt_input(psbt_input: PSBTInput): asserts psbt_input is PSBTFullInput;
export declare function assert_has_prevout(pvin: PSBTInput, idx: number): asserts pvin is PSBTInput & {
    witnessUtxo: PSBTPrevouts;
};
export declare function assert_has_prevouts(vins: PSBTInput[]): asserts vins is (PSBTInput & {
    witnessUtxo: PSBTPrevouts;
})[];
export declare function assert_is_funded(pdata: PSBTData): void;
