import { Bytes } from '@vbyte/buff';
import type { ChainNetwork, ProtoProfile } from '../types/index.js';
export declare class GuardianSigner {
    private readonly _address;
    private readonly _proto;
    private readonly _pubkey;
    constructor(proto: ProtoProfile, seckey: Bytes);
    get address(): string;
    get network(): ChainNetwork;
    get proto(): ProtoProfile;
    get pubkey(): string;
    get sign(): {
        input: {
            cosign: (psbt: string, index: number) => string;
            liquidate: (psbt: string, index: number) => string;
            spend: (psbt: string, index: number) => string;
        };
        request: {
            vault_open: (request: import("../types/vault_request.js").VaultOpenRequest) => import("../types/vault_response.js").VaultOpenResponse;
            vault_borrow: (request: import("../types/vault_request.js").VaultBorrowRequest) => import("../types/vault_response.js").VaultBorrowResponse;
            vault_deposit: (request: import("../types/vault_request.js").VaultDepositRequest) => import("../types/vault_response.js").VaultBaseResponse;
            vault_close: (request: import("../types/vault_request.js").VaultCloseRequest) => import("../types/vault_response.js").VaultBaseResponse;
            vault_repay: (request: import("../types/vault_request.js").VaultRepayRequest) => import("../types/vault_response.js").VaultRepayResponse;
            vault_withdraw: (request: import("../types/vault_request.js").VaultWithdrawRequest) => import("../types/vault_response.js").VaultBaseResponse;
            vault_repo: (request: import("../types/vault_request.js").VaultRepoRequest) => import("../types/vault_response.js").VaultBaseResponse;
            vault_trim: (request: import("../types/vault_request.js").VaultTrimRequest) => import("../types/vault_response.js").VaultBaseResponse;
        };
    };
}
export declare function read_signer_seckey(signer: GuardianSigner): string;
