import { z } from 'zod';
declare const _default: {
    acct_profile: z.ZodObject<{
        acct_id: z.ZodString;
        balance: z.ZodNumber;
        issued: z.ZodNumber;
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
        acct_id: string;
        balance: number;
        issued: number;
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
    }, {
        acct_id: string;
        balance: number;
        issued: number;
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
    }>;
    mint_profile: z.ZodObject<{
        address: z.ZodString;
        divisor: z.ZodNumber;
        issued: z.ZodNumber;
        label: z.ZodString;
        mint_id: z.ZodString;
        rune_id: z.ZodString;
        symbol: z.ZodString;
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
        symbol: string;
        issued: number;
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        address: string;
        divisor: number;
        label: string;
        mint_id: string;
        rune_id: string;
    }, {
        symbol: string;
        issued: number;
        utxo: {
            value: number;
            txid: string;
            vout: number;
            script: string;
        };
        address: string;
        divisor: number;
        label: string;
        mint_id: string;
        rune_id: string;
    }>;
};
export default _default;
