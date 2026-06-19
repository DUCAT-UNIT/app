import type { VaultRepayRequest } from '@ducat-unit/core';
import type { VaultRepayRequestConfig, VaultRepayRequestCtx } from '../../../types/index.js';
export declare function create_vault_repay_ctx(vault_config: VaultRepayRequestConfig): VaultRepayRequestCtx;
export declare function create_vault_repay_psbt_1(vault_ctx: VaultRepayRequestCtx): string;
export declare function create_vault_repay_psbt_2(vault_ctx: VaultRepayRequestCtx, burn_psbt: string): string;
export declare function create_vault_repay_psbts(vault_ctx: VaultRepayRequestCtx): string[];
export declare function create_vault_repay_request(vault_ctx: VaultRepayRequestCtx, vault_psbts: string[]): VaultRepayRequest;
export declare namespace VaultRepayAPI {
    const create_ctx: typeof create_vault_repay_ctx;
    const create_psbts: typeof create_vault_repay_psbts;
    const create_request: typeof create_vault_repay_request;
}
