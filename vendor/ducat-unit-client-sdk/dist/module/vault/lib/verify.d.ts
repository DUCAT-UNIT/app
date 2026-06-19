import type { ObserveContext } from '../../../lib/observe/index.js';
import type { PSBTData, VaultAction } from '@ducat-unit/core';
import type { VaultBaseRequestConfig, VaultRequestCtx } from '../../../types/index.js';
export declare function action_requires_collateral_floor(action: VaultAction): boolean;
export declare function verify_vault_request_ctx(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_guards_authorized(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_unit_balance(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_price_contract_signatures(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_price_oracles_authorized(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_price_contract_data(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_collateral_ratio(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_psbt_output_integrity(pdata: PSBTData, expected_amounts: bigint[]): void;
export interface VerifyPsbtOptions {
    asset_pdata?: PSBTData;
    warn_only_high_fees?: boolean;
    low_feerate_tolerance?: number;
    observe?: ObserveContext;
}
export declare function verify_vault_request_psbt(vault_pdata: PSBTData, txfee_rate: number, options?: VerifyPsbtOptions): void;
export declare function verify_vault_action_rules(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>, vault_txid: string): void;
