import { z } from 'zod';
declare const _default: {
    actions: z.ZodEnum<["open", "borrow", "repay", "deposit", "withdraw", "repo", "liquidate"]>;
    flags: z.ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
    open_witness: z.ZodTuple<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>], null>;
    return_data: z.ZodDiscriminatedUnion<"is_locked", [z.ZodObject<{
        unit_balance: z.ZodNumber;
        unit_price: z.ZodNumber;
        unit_stamp: z.ZodNumber;
        vault_action: z.ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
    } & {
        is_locked: z.ZodLiteral<true>;
        thold_hash: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        thold_price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        unit_balance: number;
        unit_price: number;
        unit_stamp: number;
        vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
        is_locked: true;
        thold_hash: string;
        thold_price: number;
    }, {
        unit_balance: number;
        unit_price: number;
        unit_stamp: number;
        vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
        is_locked: true;
        thold_hash: string;
        thold_price: number;
    }>, z.ZodObject<{
        unit_balance: z.ZodNumber;
        unit_price: z.ZodNumber;
        unit_stamp: z.ZodNumber;
        vault_action: z.ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
    } & {
        is_locked: z.ZodLiteral<false>;
    }, "strip", z.ZodTypeAny, {
        unit_balance: number;
        unit_price: number;
        unit_stamp: number;
        vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
        is_locked: false;
    }, {
        unit_balance: number;
        unit_price: number;
        unit_stamp: number;
        vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
        is_locked: false;
    }>]>;
    token_data: z.ZodObject<{
        rev: z.ZodNumber;
        tag: z.ZodString;
        ver: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rev: number;
        tag: string;
        ver: number;
    }, {
        rev: number;
        tag: string;
        ver: number;
    }>;
    update_witness: z.ZodTuple<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodString, string, string>], null>;
};
export default _default;
