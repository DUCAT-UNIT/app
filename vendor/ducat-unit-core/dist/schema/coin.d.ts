import { z } from 'zod';
export declare const coin_id: z.ZodString;
export declare const utxo: z.ZodObject<{
    txid: z.ZodString;
    vout: z.ZodNumber;
    value: z.ZodInt;
    script_pk: z.ZodString;
}, z.core.$strip>;
export declare const input: z.ZodObject<{
    txid: z.ZodString;
    vout: z.ZodNumber;
    value: z.ZodInt;
    script_pk: z.ZodString;
    sequence: z.ZodNumber;
    witness: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
