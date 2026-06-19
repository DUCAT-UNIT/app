import { z } from 'zod';
export declare const commit_id: z.ZodString;
export declare const data: z.ZodObject<{
    author: z.ZodString;
    commit_id: z.ZodString;
    commit_ref: z.ZodNullable<z.ZodString>;
    content: z.ZodNullable<z.ZodString>;
    mimetype: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const record: z.ZodObject<{
    author: z.ZodString;
    commit_id: z.ZodString;
    commit_ref: z.ZodString;
    content: z.ZodString;
    mimetype: z.ZodString;
}, z.core.$strip>;
export declare const commit: z.ZodObject<{
    coin_id: z.ZodString;
    coin_index: z.ZodNumber;
    seq_code: z.ZodNumber;
    seq_version: z.ZodNumber;
    author: z.ZodString;
    commit_id: z.ZodString;
    commit_ref: z.ZodNullable<z.ZodString>;
    content: z.ZodNullable<z.ZodString>;
    mimetype: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
