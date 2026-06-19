import type { ZodError } from 'zod';
export declare function format_zod_errors(zod_error: ZodError): string[];
export declare function format_validation_message(zod_error: ZodError, error_prefix?: string): string;
