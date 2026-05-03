import { z } from 'zod';
import type { ContractCache, Literal, MintProfile } from '../../../types/index.js';
export interface GroupFetchConfig<T> {
    cache: Map<string, T>;
    ival: number;
}
export interface PointerFetchConfig {
    cache: Map<string, any>;
    ival: number;
    map: Record<number, string>;
}
export interface ProtoFetchConfig {
    cache: ContractCache;
    ival: number;
    mints: Map<string, MintProfile>;
    terms: Map<string, Literal[]>;
}
export interface RecordFetchConfig {
    index: number;
    ival: number;
    schema?: z.ZodTypeAny;
}
