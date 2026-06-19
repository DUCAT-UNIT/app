export declare function assert_dust_limit(amount: number, message?: string): void;
export declare function assert_bip340_pubkey(pubkey: string): asserts pubkey is string;
export declare function assert_safe_integer(value: number, name: string): void;
export declare function assert_finite(value: number, name: string): void;
export declare function assert_positive(value: number, name: string): void;
export declare function assert_finite_positive(value: number, name: string): void;
export declare function assert_nonnegative(value: number, name: string): void;
