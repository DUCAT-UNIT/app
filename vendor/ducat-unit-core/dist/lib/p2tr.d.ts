import { Bytes } from '@vbyte/buff';
export interface KeypathSpendSigner {
    internal_pubkey: string;
    output_pubkey: string;
    seckey: string;
}
export declare function derive_taproot_output_key(pubkey: string): string;
export declare function derive_p2tr_script(pubkey: string): string;
export declare function derive_keypath_spend_signer(seckey: Bytes): KeypathSpendSigner;
export declare function assert_keypath_script(script: Uint8Array | string, pubkey: string): void;
