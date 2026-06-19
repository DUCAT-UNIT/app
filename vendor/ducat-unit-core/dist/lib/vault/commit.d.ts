import { Buff } from '@vbyte/buff';
import type { VaultConfigData, VaultConfigPayload } from '../../types/vault.js';
export declare function encode_vault_commit_data(vault_config: VaultConfigData): Buff;
export declare function decode_vault_commit_data(payload: string): VaultConfigData;
export declare function validate_vault_config_data(config: unknown): asserts config is VaultConfigData;
export declare function validate_vault_config_payload(data: unknown): asserts data is VaultConfigPayload;
