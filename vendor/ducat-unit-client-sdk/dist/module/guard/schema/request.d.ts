import { z } from 'zod';
export declare const reserve_acct: z.ZodObject<{
    asset_id: z.ZodString;
    asset_amount: z.ZodNumber;
}, z.core.$strip>;
