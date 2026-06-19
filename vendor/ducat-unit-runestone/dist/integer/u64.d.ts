import { Option } from '../monads.js';
type BigTypedNumber<T> = bigint & {
    readonly __kind__: T;
};
export type u64 = BigTypedNumber<'u64'>;
export declare const U64_MAX_BIGINT = 18446744073709551615n;
export declare function u64(num: number | bigint): u64;
export declare namespace u64 {
    const MAX: u64;
    function checkedAdd(x: u64, y: u64): Option<u64>;
    function checkedSub(x: u64, y: u64): Option<u64>;
}
export {};
