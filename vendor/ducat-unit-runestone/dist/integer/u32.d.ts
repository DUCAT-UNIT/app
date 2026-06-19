import { Option } from '../monads.js';
type BigTypedNumber<T> = bigint & {
    readonly __kind__: T;
};
export type u32 = BigTypedNumber<'u32'>;
export declare const U32_MAX_BIGINT = 4294967295n;
export declare function u32(num: number | bigint): u32;
export declare namespace u32 {
    const MAX: u32;
    function checkedAdd(x: u32, y: u32): Option<u32>;
    function checkedSub(x: u32, y: u32): Option<u32>;
}
export {};
