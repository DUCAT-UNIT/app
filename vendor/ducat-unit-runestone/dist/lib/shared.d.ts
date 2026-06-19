import { Flaw as FlawEnum } from '../flaw.js';
import { u128, u32, u64, u8 } from '../integer/index.js';
import type { Flaw } from '../types/index.js';
export declare function getFlawString(flaw: FlawEnum): Flaw;
export declare function u8Strict(n: number): u8;
export declare function u32Strict(n: number): u32;
export declare function u64Strict(n: bigint): u64;
export declare function u128Strict(n: bigint): u128;
