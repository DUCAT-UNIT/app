import type { ObserveContext } from './types.js';
export declare function emit_debug(context: ObserveContext, name: string, fields?: Record<string, unknown>): void;
export declare function emit_error(context: ObserveContext, name: string, message: string, error: unknown, fields?: Record<string, unknown>): void;
export declare function emit_info(context: ObserveContext, name: string, message: string, fields?: Record<string, unknown>): void;
export declare function emit_warn(context: ObserveContext, name: string, message: string, fields?: Record<string, unknown>): void;
