import { Buff, Bytes } from '@vbyte/buff';
import type { PriceCommitData, PriceContract, ProtoProfile, VaultReturnData } from '../../types/index.js';
export declare function create_price_commits(price_contracts: PriceContract[]): PriceCommitData[];
export declare function encode_price_commits(proto_profile: ProtoProfile, price_commits: PriceCommitData[]): Buff;
export declare function decode_price_commits(proto_profile: ProtoProfile, commit_payload: Bytes): PriceCommitData[];
export declare function extract_vault_price_contracts(proto_profile: ProtoProfile, vault_return: VaultReturnData): PriceContract[];
