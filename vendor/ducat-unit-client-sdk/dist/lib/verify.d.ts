import type { AccountProfile, ProtocolProfile, PriceQuote, SignedUtxo, VaultProfile } from '../types/index.js';
export declare function verify_account_profile(profile: unknown): asserts profile is AccountProfile;
export declare function verify_price_quote(quote: unknown): asserts quote is PriceQuote;
export declare function verify_proto_contract(contract: unknown): asserts contract is ProtocolProfile;
export declare function verify_vault_profile(profile: unknown): asserts profile is VaultProfile;
export declare function verify_signed_utxo(utxo: SignedUtxo): void;
