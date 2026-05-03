import { z } from 'zod';
declare const _default: {
    open_config: z.ZodObject<{
        borrow_amount: z.ZodNumber;
        deposit_amount: z.ZodNumber;
        tx_feerate: z.ZodNumber;
        vault_label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
        vault_label: string;
    }, {
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
        vault_label: string;
    }>;
    borrow_config: z.ZodObject<{
        borrow_amount: z.ZodNumber;
        deposit_amount: z.ZodNumber;
        tx_feerate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
    }, {
        tx_feerate: number;
        borrow_amount: number;
        deposit_amount: number;
    }>;
    repay_config: z.ZodObject<{
        deposit_amount: z.ZodNumber;
        repay_amount: z.ZodNumber;
        tx_feerate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tx_feerate: number;
        deposit_amount: number;
        repay_amount: number;
    }, {
        tx_feerate: number;
        deposit_amount: number;
        repay_amount: number;
    }>;
    repo_config: z.ZodObject<{
        deposit_amount: z.ZodNumber;
        tx_feerate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tx_feerate: number;
        deposit_amount: number;
    }, {
        tx_feerate: number;
        deposit_amount: number;
    }>;
    deposit_config: z.ZodObject<{
        deposit_amount: z.ZodNumber;
        tx_feerate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tx_feerate: number;
        deposit_amount: number;
    }, {
        tx_feerate: number;
        deposit_amount: number;
    }>;
    withdraw_config: z.ZodObject<{
        change_amount: z.ZodNumber;
        tx_feerate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tx_feerate: number;
        change_amount: number;
    }, {
        tx_feerate: number;
        change_amount: number;
    }>;
};
export default _default;
