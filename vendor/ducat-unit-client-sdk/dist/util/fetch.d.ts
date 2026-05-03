import { z } from 'zod';
import type { ApiResponse, DataResponse, ErrorResponse } from '../types/index.js';
export declare namespace Fetch {
    function json<T>(input: URL | RequestInfo, init?: RequestInit, fetcher?: typeof fetch): Promise<ApiResponse<T>>;
    function text(input: URL | RequestInfo, init?: RequestInit, fetcher?: typeof fetch): Promise<ApiResponse<string>>;
}
export declare namespace Resolve {
    function data<T>(data: T, status?: number): DataResponse<T>;
    function schema<S extends z.ZodTypeAny>(data: unknown, schema: S, err_code?: number): ApiResponse<z.infer<S>>;
    function error(error: unknown, status?: number): ErrorResponse;
    function fail(reason: string, status?: number): ErrorResponse;
}
