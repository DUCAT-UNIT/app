import type { VaultTrimRequest } from '@ducat-unit/core';
import type { VaultTrimRequestConfig, VaultTrimRequestCtx } from '../../../types/index.js';
export declare function create_vault_trim_ctx(vault_config: VaultTrimRequestConfig): VaultTrimRequestCtx;
export declare function create_vault_trim_psbt(vault_ctx: VaultTrimRequestCtx): string;
export declare function create_vault_trim_request(vault_ctx: VaultTrimRequestCtx, vault_psbt: string): VaultTrimRequest;
export declare namespace VaultTrimAPI {
    const create_ctx: typeof create_vault_trim_ctx;
    const create_psbt: typeof create_vault_trim_psbt;
    const create_request: typeof create_vault_trim_request;
}
