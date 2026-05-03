import { BaseUtxo, VaultBorrowRequest, VaultBorrowCtx, PSBTData, AccountProfile, VaultBorrowConfig, PriceQuote, ProtocolProfile, VaultProfile, VaultTxQuote, VaultFeeOptions } from '../../../types/index.js';
export declare function create_vault_borrow_ctx(acct_profile: AccountProfile, price_quote: PriceQuote, proto_profile: ProtocolProfile, vault_profile: VaultProfile, req_config: VaultBorrowConfig): VaultBorrowCtx;
export declare function create_vault_borrow_psbt1(vault_ctx: VaultBorrowCtx, sats_utxos: BaseUtxo[]): string;
export declare function create_vault_borrow_psbt2(vault_ctx: VaultBorrowCtx, acct_psbt: PSBTData): string;
export declare function create_vault_borrow_req(vault_ctx: VaultBorrowCtx, issue_psbt: string, vault_psbt: string): VaultBorrowRequest;
export declare function get_vault_borrow_quote(vault_config: VaultBorrowConfig, fee_options?: VaultFeeOptions): VaultTxQuote;
export declare function get_vault_borrow_change(vault_config: VaultBorrowConfig, sats_utxos: BaseUtxo[]): number;
declare const _default: {
    create_ctx: typeof create_vault_borrow_ctx;
    create_psbt1: typeof create_vault_borrow_psbt1;
    create_psbt2: typeof create_vault_borrow_psbt2;
    create_req: typeof create_vault_borrow_req;
    get_quote: typeof get_vault_borrow_quote;
    get_change: typeof get_vault_borrow_change;
};
export default _default;
