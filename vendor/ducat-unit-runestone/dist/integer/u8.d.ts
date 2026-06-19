import { Option } from '../monads.js';
type BigTypedNumber<T> = bigint & {
    readonly __kind__: T;
};
export type u8 = BigTypedNumber<'u8'>;
export declare const U8_MAX_BIGINT = 255n;
export declare function u8(num: number | bigint): u8;
export declare namespace u8 {
    const MAX: u8;
    function checkedAdd(x: u8, y: u8): Option<u8>;
    function checkedSub(x: u8, y: u8): Option<u8>;
}
export {};
