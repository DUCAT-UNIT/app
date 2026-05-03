import { VaultWithdrawCtx, VaultWithdrawRequest, VaultWithdrawConfig, PriceQuote, ProtocolProfile, VaultProfile, VaultTxQuote } from '../../../types/index.js';
export declare function create_vault_withdraw_ctx(price_quote: PriceQuote, proto_profile: ProtocolProfile, vault_profile: VaultProfile, req_config: VaultWithdrawConfig): VaultWithdrawCtx;
export declare function create_vault_withdraw_psbt(vault_ctx: VaultWithdrawCtx): string;
export declare function create_vault_withdraw_req(vault_ctx: VaultWithdrawCtx, vault_psbt: string): VaultWithdrawRequest;
export declare function get_vault_withdraw_quote(vault_config: VaultWithdrawConfig): VaultTxQuote;
declare const _default: {
    create_ctx: typeof create_vault_withdraw_ctx;
    create_psbt: typeof create_vault_withdraw_psbt;
    create_req: typeof create_vault_withdraw_req;
    get_quote: typeof get_vault_withdraw_quote;
};
export default _default;
