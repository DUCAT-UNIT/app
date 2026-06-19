import type { PriceContract, PriceQuote, BreachedPriceContract, PriceObservation, ProtoProfile } from '../../types/index.js';
export declare function assert_consistent_price_stamp(configs: PriceQuote[] | PriceContract[]): void;
export declare function validate_price_observation(price_data: unknown): asserts price_data is PriceObservation;
export declare function validate_price_quote(price_quote: unknown): asserts price_quote is PriceQuote;
export declare function validate_price_contract(price_contract: unknown): asserts price_contract is PriceContract;
export declare function validate_breached_price_contract(price_contract: unknown): asserts price_contract is BreachedPriceContract;
export declare function verify_oracle_authorized(oracle_pubkey: string, proto_profile: ProtoProfile): void;
export declare function verify_oracles_authorized(oracle_pubkeys: string[], proto_profile: ProtoProfile): void;
