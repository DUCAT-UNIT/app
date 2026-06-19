type NonUndefined = Exclude<unknown, undefined>;
export declare const OptionType: {
    Some: symbol;
    None: symbol;
};
interface Match<A, B> {
    some: (val: A) => B;
    none: (() => B) | B;
}
export interface Option<T extends NonUndefined> {
    type: symbol;
    isSome(): boolean;
    isNone(): boolean;
    match<U extends NonUndefined>(fn: Match<T, U>): U;
    map<U extends NonUndefined>(fn: (val: T) => U): Option<U>;
    inspect(fn: (val: T) => void): Option<T>;
    andThen<U extends NonUndefined>(fn: (val: T) => Option<U>): Option<U>;
    or(optb: Option<T>): Option<T>;
    orElse(optb: () => Option<T>): Option<T>;
    and<U extends NonUndefined>(optb: Option<U>): Option<U>;
    unwrapOr(def: T): T;
    unwrap(): T | never;
}
interface SomeOption<T extends NonUndefined> extends Option<T> {
    unwrap(): T;
}
interface NoneOption<T extends NonUndefined> extends Option<T> {
    unwrap(): never;
}
export declare function Some<T extends NonUndefined>(val: T): Option<T>;
export declare const None: Option<never>;
export declare function isSome<T extends NonUndefined>(val: Option<T>): val is SomeOption<T>;
export declare function isNone<T extends NonUndefined>(val: Option<T>): val is NoneOption<T>;
export {};
