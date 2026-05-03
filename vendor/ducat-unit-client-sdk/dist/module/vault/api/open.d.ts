import { BaseUtxo, VaultOpenConfig, VaultOpenRequest, VaultOpenCtx, PSBTData, AccountProfile, PriceQuote, ProtocolProfile, VaultTxQuote, VaultFeeOptions } from '../../../types/index.js';
export declare function create_vault_open_ctx(acct_profile: AccountProfile, price_quote: PriceQuote, proto_profile: ProtocolProfile, req_config: VaultOpenConfig): VaultOpenCtx;
export declare function create_vault_open_psbt1(vault_ctx: VaultOpenCtx, sats_utxos: BaseUtxo[]): string;
export declare function create_vault_open_psbt2(vault_ctx: VaultOpenCtx, acct_psbt: PSBTData): string;
export declare function create_vault_open_req(vault_ctx: VaultOpenCtx, issue_psbt: string, vault_psbt: string): VaultOpenRequest;
export declare function get_vault_open_quote(vault_config: VaultOpenConfig, fee_options?: VaultFeeOptions): VaultTxQuote;
export declare function get_vault_open_change(vault_config: VaultOpenConfig, sats_utxos: BaseUtxo[]): number;
declare const _default: {
    create_ctx: typeof create_vault_open_ctx;
    create_psbt1: typeof create_vault_open_psbt1;
    create_psbt2: typeof create_vault_open_psbt2;
    create_req: typeof create_vault_open_req;
    get_quote: typeof get_vault_open_quote;
    get_change: typeof get_vault_open_change;
};
export default _default;
