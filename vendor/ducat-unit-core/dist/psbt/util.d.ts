import type { ControlBlock } from '../types/index.js';
export declare function encode_psbt_cblock(cblock: ControlBlock): Uint8Array;
export declare function decode_psbt_cblock(buffer: Uint8Array): ControlBlock;
