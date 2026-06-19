import type { PSBTData } from '../types/index.js';
export declare function decode_psbt(encoded_psbt: string | Uint8Array): PSBTData;
export declare function encode_psbt(psbt: PSBTData, version?: number): string;
export declare function parse_psbt(psbt: string | Uint8Array | PSBTData): PSBTData;
