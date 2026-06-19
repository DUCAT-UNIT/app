import { Resolve } from '@vbyte/util';
import type { WitnessRecord } from '@ducat-unit/core';
export declare function fetch_commit_all(host_url: string, page_size?: number, cursor?: string): Promise<Resolve.Type<WitnessRecord[]>>;
export declare function fetch_commit_latest(host_url: string, root_id: string): Promise<Resolve.Type<WitnessRecord>>;
export declare function fetch_commit_history(host_url: string, root_id: string, page_size?: number, cursor?: string): Promise<Resolve.Type<WitnessRecord[]>>;
