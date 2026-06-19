import { z } from 'zod';
export declare const vault: z.ZodObject<{
    liquidation_tax: z.ZodFloat32;
    liquidation_thold: z.ZodFloat32;
    reserve_pubkey: z.ZodString;
    reserve_sats_min: z.ZodInt;
    subsidy_increment: z.ZodFloat32;
    subsidy_thold: z.ZodFloat32;
    unit_asset_id: z.ZodString;
    unit_balance_min: z.ZodNumber;
    vault_ratio_min: z.ZodFloat32;
    vault_value_min: z.ZodInt;
}, z.core.$strip>;
