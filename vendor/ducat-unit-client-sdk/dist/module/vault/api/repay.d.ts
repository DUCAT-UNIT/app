import { VaultRepayCtx, VaultRepayRequest, VaultRepayConfig, AccountProfile, RuneUtxo, BaseUtxo, PSBTData, PriceQuote, ProtocolProfile, VaultProfile, VaultTxQuote, VaultFeeOptions } from '../../../types/index.js';
export declare function create_vault_repay_ctx(acct_profile: AccountProfile, price_quote: PriceQuote, proto_profile: ProtocolProfile, vault_profile: VaultProfile, req_config: VaultRepayConfig): VaultRepayCtx;
export declare function create_vault_repay_psbt1(vault_ctx: VaultRepayCtx, sats_utxos: BaseUtxo[], unit_utxos: RuneUtxo[]): string;
export declare function create_vault_repay_psbt2(vault_ctx: VaultRepayCtx, acct_psbt: PSBTData): string;
export declare function create_vault_repay_req(vault_ctx: VaultRepayCtx, repay_psbt: string, vault_psbt: string): VaultRepayRequest;
export declare function get_vault_repay_quote(vault_config: VaultRepayConfig, fee_options?: VaultFeeOptions): VaultTxQuote;
export declare function get_vault_repay_change(vault_config: VaultRepayConfig, sats_utxos: BaseUtxo[]): number;
declare const _default: {
    create_ctx: typeof create_vault_repay_ctx;
    create_psbt1: typeof create_vault_repay_psbt1;
    create_psbt2: typeof create_vault_repay_psbt2;
    create_req: typeof create_vault_repay_req;
    get_quote: typeof get_vault_repay_quote;
    get_change: typeof get_vault_repay_change;
};
export default _default;
