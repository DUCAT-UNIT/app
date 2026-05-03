export declare function gen_seckey(secret?: string): string;
export declare function get_pubkey(seckey: string): string;
export declare function sign_ecdsa(seckey: string, message: string): string;
export declare function verify_ecdsa_pubkey(pubkey: unknown): asserts pubkey is string;
export declare function verify_ecdsa_sig(message: string, pubkey: string, signature: string): void;
export declare function sign_bip340(seckey: string, message: string): string;
export declare function verify_bip340_pubkey(pubkey: unknown): asserts pubkey is string;
export declare function verify_bip340_sig(message: string, pubkey: string, signature: string): void;
