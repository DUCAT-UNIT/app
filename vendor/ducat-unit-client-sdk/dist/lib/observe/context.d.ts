import type { ObserveContext, ObservabilityOptions } from './types.js';
export declare function get_observe_context(options?: ObservabilityOptions | ObserveContext, default_fields?: Record<string, unknown>): ObserveContext;
export declare function child_observe_context(context: ObserveContext, fields?: Record<string, unknown>, span?: ObserveContext['span']): ObserveContext;
export declare function with_observe_span<T>(context: ObserveContext, name: string, fields: Record<string, unknown>, fn: (scope: ObserveContext) => T): T;
