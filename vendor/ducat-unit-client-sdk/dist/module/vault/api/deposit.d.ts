import { BaseUtxo, PriceQuote, ProtocolProfile, VaultDepositConfig, VaultDepositCtx, VaultDepositRequest, VaultFeeOptions, VaultProfile, VaultTxQuote } from '../../../types/index.js';
export declare function create_vault_deposit_ctx(price_quote: PriceQuote, proto_profile: ProtocolProfile, vault_profile: VaultProfile, req_config: VaultDepositConfig): VaultDepositCtx;
export declare function create_vault_deposit_psbt(vault_ctx: VaultDepositCtx, sats_utxos: BaseUtxo[]): string;
export declare function create_vault_deposit_req(vault_ctx: VaultDepositCtx, vault_psbt: string): VaultDepositRequest;
export declare function get_vault_deposit_quote(vault_config: VaultDepositConfig, fee_options?: VaultFeeOptions): VaultTxQuote;
declare function get_vault_deposit_change(vault_config: VaultDepositConfig, vin_utxos: BaseUtxo[]): number;
declare const _default: {
    create_ctx: typeof create_vault_deposit_ctx;
    create_psbt: typeof create_vault_deposit_psbt;
    create_req: typeof create_vault_deposit_req;
    get_quote: typeof get_vault_deposit_quote;
    get_change: typeof get_vault_deposit_change;
};
export default _default;
