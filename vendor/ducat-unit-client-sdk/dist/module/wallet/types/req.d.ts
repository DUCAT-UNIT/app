import type { ChainNetwork, VaultBorrowRequest, VaultDepositRequest, VaultOpenRequest, VaultRepayRequest, VaultRepoRequest, VaultWithdrawRequest } from '../../../types/index.js';
interface WalletBaseRequest {
    contract_id: string;
    network: ChainNetwork;
}
export type WalletVaultOpenRequest = WalletBaseRequest & VaultOpenRequest;
export type WalletVaultBorrowRequest = WalletBaseRequest & VaultBorrowRequest;
export type WalletVaultRepayRequest = WalletBaseRequest & VaultRepayRequest;
export type WalletVaultRepoRequest = WalletBaseRequest & VaultRepoRequest;
export type WalletVaultDepositRequest = WalletBaseRequest & VaultDepositRequest;
export type WalletVaultWithdrawRequest = WalletBaseRequest & VaultWithdrawRequest;
export {};
