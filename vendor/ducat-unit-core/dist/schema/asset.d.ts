import { z } from 'zod';
export declare const asset_id: z.ZodString;
export declare const account: z.ZodObject<{
    asset_id: z.ZodString;
    asset_balance: z.ZodInt;
    asset_reserve: z.ZodInt;
    coin_id: z.ZodString;
    coin_script: z.ZodString;
    coin_value: z.ZodInt;
}, z.core.$strip>;
export declare const profile: z.ZodObject<{
    div: z.ZodNumber;
    id: z.ZodString;
    label: z.ZodString;
    symbol: z.ZodString;
    supply: z.ZodString;
}, z.core.$strip>;
