import type { ZodError } from 'zod';
export type ValidationResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: ZodError;
    message: string;
};
export interface ValidateOptions {
    error_prefix?: string;
}
