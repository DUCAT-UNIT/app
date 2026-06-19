import { z } from 'zod';
export declare const vault_open: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
    issue_tx: z.ZodString;
    issue_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_borrow: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
    issue_tx: z.ZodString;
    issue_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_repay: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
    burn_tx: z.ZodString;
    burn_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_deposit: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_close: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_withdraw: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_repo: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
}, z.core.$strip>;
export declare const vault_trim: z.ZodObject<{
    vault_tx: z.ZodString;
    vault_txid: z.ZodString;
}, z.core.$strip>;
