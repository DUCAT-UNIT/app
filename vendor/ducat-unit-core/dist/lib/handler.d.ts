import type { GuardianSigner } from '../class/cosigner.js';
import type { VaultBorrowRequest, VaultBorrowResponse, VaultDepositRequest, VaultCloseRequest, VaultOpenRequest, VaultOpenResponse, VaultRepayRequest, VaultRepayResponse, VaultRepoRequest, VaultBaseResponse, VaultWithdrawRequest, VaultTrimRequest } from '../types/index.js';
export declare function sign_vault_request_api(guard: GuardianSigner): {
    vault_open: (request: VaultOpenRequest) => VaultOpenResponse;
    vault_borrow: (request: VaultBorrowRequest) => VaultBorrowResponse;
    vault_deposit: (request: VaultDepositRequest) => VaultBaseResponse;
    vault_close: (request: VaultCloseRequest) => VaultBaseResponse;
    vault_repay: (request: VaultRepayRequest) => VaultRepayResponse;
    vault_withdraw: (request: VaultWithdrawRequest) => VaultBaseResponse;
    vault_repo: (request: VaultRepoRequest) => VaultBaseResponse;
    vault_trim: (request: VaultTrimRequest) => VaultBaseResponse;
};
