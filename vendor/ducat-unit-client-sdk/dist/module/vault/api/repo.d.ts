import { get_liquidation_ctx, get_liquidation_quote, get_liquid_profile } from '../../../module/vault/lib/index.js';
import { BaseUtxo, PriceQuote, ProtocolProfile, PSBTData, VaultRepoConfig, VaultRepoCtx, VaultRepoRequest, VaultProfile, LiquidationCtx, VaultFeeOptions } from '../../../types/index.js';
export declare function create_vault_repo_ctx(price_quote: PriceQuote, proto_profile: ProtocolProfile, vault_profile: VaultProfile, req_config: VaultRepoConfig): VaultRepoCtx;
export declare function create_vault_repo_psbt1(liquid_ctx: LiquidationCtx, vault_ctx: VaultRepoCtx, fund_utxos: BaseUtxo[]): string;
export declare function create_vault_repo_psbt2(liquid_ctx: LiquidationCtx, vault_ctx: VaultRepoCtx, liquid_psbt: PSBTData): string;
export declare function create_vault_repo_req(liquid_ctx: LiquidationCtx, vault_ctx: VaultRepoCtx, liquid_psbt: string, vault_psbt: string): VaultRepoRequest;
export declare function get_vault_repo_quote(vault_config: VaultRepoConfig, vault_count: number, fee_options?: VaultFeeOptions): {
    tx_vsize: number;
    tx_cost: number;
    total_cost: number;
};
export declare function get_vault_repo_change(liquid_ctx: LiquidationCtx, vault_config: VaultRepoConfig, sats_utxos: BaseUtxo[]): number;
declare const _default: {
    create_ctx: typeof create_vault_repo_ctx;
    create_psbt1: typeof create_vault_repo_psbt1;
    create_psbt2: typeof create_vault_repo_psbt2;
    create_req: typeof create_vault_repo_req;
    get_tx_quote: typeof get_vault_repo_quote;
    get_change: typeof get_vault_repo_change;
    liquidation: {
        get_ctx: typeof get_liquidation_ctx;
        get_quote: typeof get_liquidation_quote;
        get_profile: typeof get_liquid_profile;
    };
};
export default _default;
