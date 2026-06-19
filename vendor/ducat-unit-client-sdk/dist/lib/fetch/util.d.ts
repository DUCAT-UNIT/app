import { Resolve } from '@vbyte/util';
import type { ZodSchema } from 'zod';
export declare function safe_path_segment(value: string, label?: string): string;
export interface FetchValidationOptions {
    max_age_ms?: number;
}
export declare function validate_response_freshness(data: unknown, max_age_ms?: number): string | undefined;
export declare function validate_fetch_response<T>(schema: ZodSchema<T>, data: unknown, error_prefix: string, options?: FetchValidationOptions): Resolve.Type<T>;
export declare function validate_fetch_list_response<T>(schema: ZodSchema<T>, data: unknown, error_prefix: string, options?: FetchValidationOptions): Resolve.Type<T>;
