import type { LiquidationQuote, ProtoProfile } from '../../types/index.js';
export declare function get_liquidation_quote(proto_profile: ProtoProfile, claimed_sats: number, claimed_unit: number, unit_price: number): LiquidationQuote;
export declare function get_partial_liquidation_quote(proto_profile: ProtoProfile, liquid_quote: LiquidationQuote, recap_amount: number, unit_price: number): LiquidationQuote;
