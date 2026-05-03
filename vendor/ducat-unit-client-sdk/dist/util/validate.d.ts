import { Bytes } from '@cmdcode/buff';
import { z } from 'zod';
export declare namespace Check {
    function exists<T>(value?: T | null): value is NonNullable<T>;
    function is_number(value: unknown): value is number;
    function is_bigint(value: unknown): value is bigint;
    function is_hex(value: unknown): value is string;
    function is_hash(value: unknown): value is string;
    function is_schema<S extends z.ZodTypeAny>(input: unknown, schema: S): input is z.infer<S>;
}
export declare namespace Assert {
    function ok(value: unknown, message?: string): asserts value;
    function exists<T>(value: T | null, msg?: string): asserts value is NonNullable<T>;
    function is_number(value: unknown): asserts value is number;
    function is_bigint(value: unknown): asserts value is bigint;
    function is_hex(value: unknown): asserts value is string;
    function is_hash(value: unknown, msg?: string): asserts value is string;
    function size(input: Bytes, size: number): void;
    function is_schema<S extends z.ZodTypeAny>(input: unknown, schema: S, msg?: string): asserts input is z.infer<S>;
}
