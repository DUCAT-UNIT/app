export type Literal = string | number | boolean | null;
export type ApiResponse<T = any> = DataResponse<T> | ErrorResponse;
export interface DataResponse<T> {
    ok: true;
    data: T;
    error?: string;
    status: number;
}
export interface ErrorResponse {
    ok: false;
    error: string;
    status: number;
}
export interface ScanResponse<T> {
    entries: T[];
    errors: Literal[][];
}
export interface FetchConfig<T> {
    cache: T[];
    filter?: number[];
    interval: number;
}
