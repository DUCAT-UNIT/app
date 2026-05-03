import { z } from 'zod';
declare const _default: {
    prevout: z.ZodObject<{
        rdata: z.ZodDiscriminatedUnion<"is_locked", [z.ZodObject<{
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
        utxo: z.ZodObject<{
            txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            vout: z.ZodNumber;
            value: z.ZodNumber;
            script: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        rdata: {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: true;
            thold_hash: string;
            thold_price: number;
        } | {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: false;
        };
    }, {
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        rdata: {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: true;
            thold_hash: string;
            thold_price: number;
        } | {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: false;
        };
    }>;
    profile: z.ZodObject<{
        rdata: z.ZodDiscriminatedUnion<"is_locked", [z.ZodObject<{
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
        utxo: z.ZodObject<{
            txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            vout: z.ZodNumber;
            value: z.ZodNumber;
            script: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }>;
    } & {
        acct_id: z.ZodString;
        guard_pk: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        master_id: z.ZodString;
        vault_pk: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        acct_id: string;
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        master_id: string;
        rdata: {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: true;
            thold_hash: string;
            thold_price: number;
        } | {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: false;
        };
        guard_pk: string;
        vault_pk: string;
    }, {
        acct_id: string;
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        master_id: string;
        rdata: {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: true;
            thold_hash: string;
            thold_price: number;
        } | {
            unit_balance: number;
            unit_price: number;
            unit_stamp: number;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            is_locked: false;
        };
        guard_pk: string;
        vault_pk: string;
    }>;
    record: z.ZodObject<{
        gpk: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        mid: z.ZodString;
        vpk: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        ver: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ver: number;
        gpk: string;
        mid: string;
        vpk: string;
    }, {
        ver: number;
        gpk: string;
        mid: string;
        vpk: string;
    }>;
    token: z.ZodObject<{
        data: z.ZodObject<{
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
        ptr: z.ZodNumber;
        utxo: z.ZodObject<{
            txid: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            vout: z.ZodNumber;
            value: z.ZodNumber;
            script: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }, {
            value: number;
            txid: string;
            vout: number;
            script: string;
        }>;
        vid: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        ptr: number;
        data: {
            rev: number;
            tag: string;
            ver: number;
        };
        vid: string;
    }, {
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        ptr: number;
        data: {
            rev: number;
            tag: string;
            ver: number;
        };
        vid: string;
    }>;
};
export default _default;
