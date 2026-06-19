import { z } from 'zod';
export declare function parse_schema<S extends z.ZodTypeAny>(input: unknown, schema: S, error?: string): z.infer<S>;
export declare function assert_schema<S extends z.ZodTypeAny>(input: unknown, schema: S, error?: string): asserts input is z.infer<S>;
