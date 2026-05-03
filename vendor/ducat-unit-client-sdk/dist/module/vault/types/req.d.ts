import type { BaseUtxo, LiquidInput, PriceQuote, SignedUtxo, VaultActionFlag, VaultTokenData } from '../../../types/index.js';
interface BaseRequest {
    contract_id: string;
    tx_feerate: number;
    vault_action: VaultActionFlag;
    vault_quote: PriceQuote;
    vault_psbt?: string;
    vault_pubkey: string;
    vault_txhex?: string;
    vault_txid: string;
}
export interface VaultOpenRequest extends BaseRequest {
    acct_id: string;
    acct_utxo: BaseUtxo;
    borrow_amount: number;
    connect_input: SignedUtxo;
    deposit_amount: number;
    issue_psbt?: string;
    issue_txhex?: string;
    issue_txid: string;
    sats_address: string;
    sats_inputs: SignedUtxo[];
    unit_address: string;
    unit_postage: number;
    token_address: string;
    token_data: VaultTokenData;
    token_postage: number;
}
export interface VaultBorrowRequest extends BaseRequest {
    acct_id: string;
    acct_utxo: BaseUtxo;
    borrow_amount: number;
    connect_input: SignedUtxo;
    deposit_amount: number;
    issue_psbt?: string;
    issue_txhex?: string;
    issue_txid: string;
    sats_address: string;
    sats_inputs: SignedUtxo[];
    unit_address: string;
    unit_postage: number;
    vault_input: SignedUtxo;
}
export interface VaultRepayRequest extends BaseRequest {
    acct_id: string;
    acct_utxo: BaseUtxo;
    connect_input: SignedUtxo;
    repay_amount: number;
    repay_psbt?: string;
    repay_txhex?: string;
    repay_txid: string;
    sats_inputs: SignedUtxo[];
    unit_inputs: SignedUtxo[];
    vault_input: SignedUtxo;
}
export interface VaultRepoRequest extends BaseRequest {
    connect_input: SignedUtxo;
    deposit_amount: number;
    repo_amount: number;
    liquid_psbt?: string;
    liquid_txhex?: string;
    liquid_txid: string;
    liquid_inputs: LiquidInput[];
    sats_inputs: SignedUtxo[];
    vault_input: SignedUtxo;
}
export interface VaultDepositRequest extends BaseRequest {
    deposit_amount: number;
    sats_address: string;
    sats_inputs: SignedUtxo[];
    vault_input: SignedUtxo;
}
export interface VaultWithdrawRequest extends BaseRequest {
    change_amount: number;
    sats_address: string;
    vault_input: SignedUtxo;
}
export {};
