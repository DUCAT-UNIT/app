import { WebSocketClient } from '../../../class/socket.js';
import type { ChainNetwork } from '@ducat-unit/core';
import type { ObserveContext, ObservabilityOptions } from '../../../lib/observe/index.js';
export interface GuardianClientOptions {
    allow_insecure_ws?: boolean;
    observability?: ObservabilityOptions | ObserveContext;
}
export declare class GuardianClient {
    private readonly _network;
    private readonly _observe;
    private readonly _socket;
    constructor(host_url: string, network: ChainNetwork, options?: GuardianClientOptions);
    get network(): "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
    get observe(): ObserveContext;
    get request(): {
        asset: {
            reserve: (request: import("../types/request.js").AssetAccountRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").AssetAccount>;
        };
        vault: {
            borrow: (request: import("@ducat-unit/core").VaultBorrowRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultBorrowResponse>;
            close: (request: import("@ducat-unit/core").VaultCloseRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultBaseResponse>;
            deposit: (request: import("@ducat-unit/core").VaultDepositRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultBaseResponse>;
            open: (request: import("@ducat-unit/core").VaultOpenRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultOpenResponse>;
            repay: (request: import("@ducat-unit/core").VaultRepayRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultRepayResponse>;
            repo: (request: import("@ducat-unit/core").VaultRepoRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultBaseResponse>;
            trim: (request: import("@ducat-unit/core").VaultTrimRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultBaseResponse>;
            withdraw: (request: import("@ducat-unit/core").VaultWithdrawRequest) => import("../../../class/socket.js").SocketSubscription<import("@ducat-unit/core").VaultBaseResponse>;
        };
    };
    get socket(): WebSocketClient;
    close(): void;
}
