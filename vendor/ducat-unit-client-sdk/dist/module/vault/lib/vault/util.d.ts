import type { VaultBaseRequest } from '@ducat-unit/core';
import type { VaultBaseRequestConfig, VaultRequestCtx } from '../../../../types/index.js';
export declare function get_vault_context_coin_value(vault_ctx: VaultRequestCtx): number;
export declare function create_vault_ctx<T extends VaultBaseRequestConfig>(vault_config: T): VaultRequestCtx<T>;
export declare function create_vault_request(vault_ctx: VaultRequestCtx): VaultBaseRequest;
export declare function get_vault_client_pubkey(vault_config: VaultBaseRequestConfig): string;
