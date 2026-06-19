import { Buff, Stream } from '@vbyte/buff';
import type { ClearedVaultReturnData, ProtoProfile, VaultProfile, VaultReturnData } from '../../types/index.js';
export declare const DEFAULT_RETURN_DATA: () => ClearedVaultReturnData;
export declare function encode_vault_return_script(proto_profile: ProtoProfile, return_data: VaultReturnData): Buff;
export declare function decode_vault_return_script(proto_profile: ProtoProfile, return_script: string | Uint8Array): VaultReturnData;
export declare function encode_guardian_indices(proto_profile: ProtoProfile, guard_pubkeys: string[]): Buff;
export declare function extract_guardian_pubkeys(proto_profile: ProtoProfile, data_stream: Stream): string[];
export declare function get_vault_profile_return_data(vault_profile: VaultProfile): VaultReturnData;
