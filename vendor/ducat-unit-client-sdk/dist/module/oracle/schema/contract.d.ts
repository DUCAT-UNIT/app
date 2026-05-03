import { z } from 'zod';
declare const _default: {
    adr_ptr: z.ZodTuple<[z.ZodString, z.ZodNumber], null>;
    group_contract: z.ZodObject<{
        adr: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        adr: string;
    }, {
        adr: string;
    }>;
    point_contract: z.ZodObject<{
        adr: z.ZodString;
    } & {
        ptr: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, "many">;
    }, "strip", z.ZodTypeAny, {
        adr: string;
        ptr: [number, number][];
    }, {
        adr: string;
        ptr: [number, number][];
    }>;
    quorum_contract: z.ZodObject<{
        adr: z.ZodString;
    } & {
        pub: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        thd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        adr: string;
        pub: string;
        thd: number;
    }, {
        adr: string;
        pub: string;
        thd: number;
    }>;
    rec_ptr: z.ZodTuple<[z.ZodString, z.ZodString], null>;
    val_ptr: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
};
export default _default;
