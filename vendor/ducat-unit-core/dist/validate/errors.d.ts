import type { ZodError, ZodIssue } from 'zod';
import type { ValidationError } from '../validate/types.js';
export declare function format_zod_errors(error: ZodError): ValidationError[];
export declare function format_zod_issue(issue: ZodIssue): ValidationError;
export declare function format_zod_error(error: ZodError, validator_name?: string): string;
export declare function format_validation_error(error: ValidationError): string;
export declare function create_validation_error(validator_name: string, details: string): string;
