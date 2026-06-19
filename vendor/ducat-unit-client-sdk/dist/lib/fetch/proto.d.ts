import { Resolve } from '@vbyte/util';
import type { ProtoProfile } from '@ducat-unit/core';
import type { ProtoHistoryRecord } from '../../types/index.js';
export declare function fetch_proto_data(host_url: string): Promise<Resolve.Type<ProtoProfile>>;
export declare function fetch_proto_history(host_url: string): Promise<Resolve.Type<ProtoHistoryRecord[]>>;
