import type { ZodError } from 'zod';
export interface ValidationErrorOptions extends ErrorOptions {
    zod_error?: ZodError;
}
export declare class DucatError extends Error {
    readonly code: string;
    constructor(message: string, code?: string, options?: ErrorOptions);
}
export declare class WebSocketError extends DucatError {
    constructor(message: string, options?: ErrorOptions);
}
export declare class VaultError extends DucatError {
    constructor(message: string, options?: ErrorOptions);
}
export declare class ValidationError extends DucatError {
    readonly zod_error?: ZodError;
    readonly details: string[];
    constructor(message: string, options?: ValidationErrorOptions);
}
export declare class GuardianError extends DucatError {
    constructor(message: string, options?: ErrorOptions);
}
