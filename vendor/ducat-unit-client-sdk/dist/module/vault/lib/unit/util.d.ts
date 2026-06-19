import type { VaultBorrowRequestCtx, VaultRequestCtx, VaultOpenRequestCtx } from '../../../../types/index.js';
import type { AssetPool } from '@ducat-unit/core';
export declare function get_unit_issuer_address(vault_ctx: VaultOpenRequestCtx | VaultBorrowRequestCtx): string;
export declare function get_unit_asset_pool(vault_ctx: VaultRequestCtx): AssetPool;
export declare function get_new_unit_balance(unit_balance: number, repay_amount: number): number;
export declare function get_unit_change(input_amount: number, repay_amount: number): number;
