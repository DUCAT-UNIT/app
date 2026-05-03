import { z } from 'zod';
declare const _default: {
    liquid_terms: z.ZodObject<{
        liquidation_thold: z.ZodNumber;
        reserve_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        reserve_sats_min: z.ZodNumber;
        liquid_tax_rate: z.ZodNumber;
        subsidy_inc_rate: z.ZodNumber;
        subsidy_inc_thold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        liquidation_thold: number;
        reserve_pubkey: string;
        reserve_sats_min: number;
        liquid_tax_rate: number;
        subsidy_inc_rate: number;
        subsidy_inc_thold: number;
    }, {
        liquidation_thold: number;
        reserve_pubkey: string;
        reserve_sats_min: number;
        liquid_tax_rate: number;
        subsidy_inc_rate: number;
        subsidy_inc_thold: number;
    }>;
    vault_terms: z.ZodObject<{
        collateral_min: z.ZodNumber;
        internal_key: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        sats_balance_min: z.ZodNumber;
        unit_balance_min: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        collateral_min: number;
        internal_key: string;
        sats_balance_min: number;
        unit_balance_min: number;
    }, {
        collateral_min: number;
        internal_key: string;
        sats_balance_min: number;
        unit_balance_min: number;
    }>;
    vault_action: z.ZodUnion<[z.ZodLiteral<"open">, z.ZodLiteral<"borrow">, z.ZodLiteral<"repay">, z.ZodLiteral<"deposit">, z.ZodLiteral<"withdraw">, z.ZodLiteral<"repo">, z.ZodLiteral<"liquidate">]>;
    vault_flag: z.ZodUnion<[z.ZodLiteral<"o">, z.ZodLiteral<"b">, z.ZodLiteral<"r">, z.ZodLiteral<"d">, z.ZodLiteral<"w">, z.ZodLiteral<"x">, z.ZodLiteral<"l">]>;
};
export default _default;
