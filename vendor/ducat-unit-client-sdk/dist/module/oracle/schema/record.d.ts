import { z } from 'zod';
declare const _default: {
    acct_record: z.ZodObject<{
        iss: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        iss: number;
    }, {
        iss: number;
    }>;
    host_record: z.ZodObject<{
        pub: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pub: string;
        url: string;
    }, {
        pub: string;
        url: string;
    }>;
    token_record: z.ZodObject<{
        dat: z.ZodAny;
        ref: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ref: string;
        dat?: any;
    }, {
        ref: string;
        dat?: any;
    }>;
    val_arr: z.ZodTuple<[z.ZodNumber], z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
};
export default _default;
