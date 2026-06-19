import { Buff } from '@vbyte/buff';
import { Option } from '../monads.js';
import { SeekBuffer } from '../seekbuffer.js';
import { u64 } from './u64.js';
import { u32 } from './u32.js';
import { u8 } from './u8.js';
type BigTypedNumber<T> = bigint & {
    readonly __kind__: T;
};
export type u128 = BigTypedNumber<'u128'>;
export declare const U128_MAX_BIGINT = 340282366920938463463374607431768211455n;
export declare function u128(num: number | bigint): u128;
export declare namespace u128 {
    const MAX: u128;
    function checkedAdd(x: u128, y: u128): Option<u128>;
    function checkedAddThrow(x: u128, y: u128): u128;
    function checkedSub(x: u128, y: u128): Option<u128>;
    function checkedSubThrow(x: u128, y: u128): u128;
    function checkedMultiply(x: u128, y: u128): Option<u128>;
    function saturatingAdd(x: u128, y: u128): u128;
    function saturatingMultiply(x: u128, y: u128): u128;
    function saturatingSub(x: u128, y: u128): u128;
    function decodeVarInt(seekBuffer: SeekBuffer): Option<u128>;
    function tryDecodeVarInt(seekBuffer: SeekBuffer): u128;
    function encodeVarInt(value: u128): Buff;
    function tryIntoU64(n: u128): Option<u64>;
    function tryIntoU32(n: u128): Option<u32>;
    function tryIntoU8(n: u128): Option<u8>;
}
export declare function getAllU128(buffer: Buff): Generator<u128>;
export {};
