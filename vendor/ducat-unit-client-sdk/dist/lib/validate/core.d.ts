import type { ZodSchema } from 'zod';
import type { ValidationResult, ValidateOptions } from './types.js';
export declare function validate<T>(schema: ZodSchema<T>, data: unknown, error_prefix?: string): T;
export declare function safe_validate<T>(schema: ZodSchema<T>, data: unknown, options?: ValidateOptions): ValidationResult<T>;
export declare function assert_valid<T>(schema: ZodSchema<T>, data: unknown, error_prefix?: string): asserts data is T;
