import { z } from 'zod';
declare const _default: {
    borrow_config: z.ZodObject<{
        sats_address: z.ZodString;
        tx_feerate: z.ZodNumber;
    } & {
        borrow_amount: z.ZodNumber;
        deposit_amount: z.ZodNumber;
        unit_address: z.ZodString;
        unit_postage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sats_address: string;
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
        unit_address: string;
        unit_postage: number;
    }, {
        sats_address: string;
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
        unit_address: string;
        unit_postage: number;
    }>;
    deposit_config: z.ZodObject<{
        sats_address: z.ZodString;
        tx_feerate: z.ZodNumber;
    } & {
        deposit_amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sats_address: string;
        tx_feerate: number;
        deposit_amount: number;
    }, {
        sats_address: string;
        tx_feerate: number;
        deposit_amount: number;
    }>;
    open_config: z.ZodObject<{
        sats_address: z.ZodString;
        tx_feerate: z.ZodNumber;
    } & {
        borrow_amount: z.ZodNumber;
        deposit_amount: z.ZodNumber;
        token_address: z.ZodString;
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
        token_postage: z.ZodNumber;
        unit_address: z.ZodString;
        unit_postage: z.ZodNumber;
        vault_pubkey: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    }, "strip", z.ZodTypeAny, {
        sats_address: string;
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
        token_address: string;
        token_data: {
            rev: number;
            tag: string;
            ver: number;
        };
        token_postage: number;
        unit_address: string;
        unit_postage: number;
        vault_pubkey: string;
    }, {
        sats_address: string;
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
        token_address: string;
        token_data: {
            rev: number;
            tag: string;
            ver: number;
        };
        token_postage: number;
        unit_address: string;
        unit_postage: number;
        vault_pubkey: string;
    }>;
    repay_config: z.ZodObject<{
        sats_address: z.ZodString;
        tx_feerate: z.ZodNumber;
    } & {
        deposit_amount: z.ZodNumber;
        repay_amount: z.ZodNumber;
        unit_address: z.ZodString;
        unit_postage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sats_address: string;
        tx_feerate: number;
        deposit_amount: number;
        unit_address: string;
        unit_postage: number;
        repay_amount: number;
    }, {
        sats_address: string;
        tx_feerate: number;
        deposit_amount: number;
        unit_address: string;
        unit_postage: number;
        repay_amount: number;
    }>;
    repo_config: z.ZodObject<{
        sats_address: z.ZodString;
        tx_feerate: z.ZodNumber;
    } & {
        deposit_amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sats_address: string;
        tx_feerate: number;
        deposit_amount: number;
    }, {
        sats_address: string;
        tx_feerate: number;
        deposit_amount: number;
    }>;
    withdraw_config: z.ZodObject<{
        sats_address: z.ZodString;
        tx_feerate: z.ZodNumber;
    } & {
        change_amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sats_address: string;
        tx_feerate: number;
        change_amount: number;
    }, {
        sats_address: string;
        tx_feerate: number;
        change_amount: number;
    }>;
};
export default _default;
