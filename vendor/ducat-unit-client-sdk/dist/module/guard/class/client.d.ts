import { SocketSubscription, WebSocketClient } from '../../../class/socket.js';
import type { ChainNetwork, GuardianTopic, SubscriptionEventMap } from '../../../types/index.js';
export declare class GuardianClient extends WebSocketClient {
    private readonly _network;
    private readonly _pubkey;
    constructor(host_url: string, network: ChainNetwork, pubkey: string);
    get network(): ChainNetwork;
    get pubkey(): string;
    get req(): {
        unit: {
            reserve: (request: import("../../../types/index.js").UnitAccountConfig) => SocketSubscription<import("../../../types/index.js").UnitSubscriptionMap>;
        };
        vault: {
            borrow: (request: import("../../../types/index.js").WalletVaultBorrowRequest) => SocketSubscription<import("../../../types/index.js").VaultBorrowSubscription>;
            deposit: (request: import("../../../types/index.js").WalletVaultDepositRequest) => SocketSubscription<import("../../../types/index.js").VaultUpdateSubscription>;
            open: (request: import("../../../types/index.js").WalletVaultOpenRequest) => SocketSubscription<import("../../../types/index.js").VaultOpenSubscription>;
            repay: (request: import("../../../types/index.js").WalletVaultRepayRequest) => SocketSubscription<import("../../../types/index.js").VaultRepaySubscription>;
            repo: (request: import("../../../types/index.js").WalletVaultRepoRequest) => SocketSubscription<import("../../../types/index.js").VaultRepoSubscription>;
            withdraw: (request: import("../../../types/index.js").WalletVaultWithdrawRequest) => SocketSubscription<import("../../../types/index.js").VaultUpdateSubscription>;
        };
    };
    subscribe<T extends SubscriptionEventMap>(topic: GuardianTopic, identifier?: string): SocketSubscription<T>;
}
