import type { OpReturnData, ProtoTxOutput } from '../types/index.js';
export declare function get_op_return_data(script_pk: string): OpReturnData | null;
export declare function find_opreturn_output(vout: ProtoTxOutput[]): ProtoTxOutput | null;
