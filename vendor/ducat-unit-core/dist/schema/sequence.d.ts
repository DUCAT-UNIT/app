import { z } from 'zod';
export declare const type: z.ZodEnum<{
    number: "number";
    timelock: "timelock";
    metadata: "metadata";
    null: "null";
}>;
export declare const nullified: z.ZodObject<{
    type: z.ZodLiteral<"null">;
}, z.core.$strip>;
export declare const number: z.ZodObject<{
    type: z.ZodLiteral<"number">;
    value: z.ZodNumber;
}, z.core.$strip>;
export declare const timelock: z.ZodObject<{
    format: z.ZodEnum<{
        height: "height";
        stamp: "stamp";
    }>;
    type: z.ZodLiteral<"timelock">;
    value: z.ZodNumber;
}, z.core.$strip>;
export declare const metadata: z.ZodObject<{
    code: z.ZodNumber;
    type: z.ZodLiteral<"metadata">;
    version: z.ZodNumber;
}, z.core.$strip>;
export declare const data: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"null">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"number">;
    value: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    format: z.ZodEnum<{
        height: "height";
        stamp: "stamp";
    }>;
    type: z.ZodLiteral<"timelock">;
    value: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    code: z.ZodNumber;
    type: z.ZodLiteral<"metadata">;
    version: z.ZodNumber;
}, z.core.$strip>], "type">;
