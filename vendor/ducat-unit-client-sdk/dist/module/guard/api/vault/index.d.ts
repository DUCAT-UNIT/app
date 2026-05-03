import { GuardianClient } from '../../class/client.js';
export default function (client: GuardianClient): {
    borrow: (request: import("../../../wallet/index.js").WalletVaultBorrowRequest) => import("../../../../index.js").SocketSubscription<import("../../index.js").VaultBorrowSubscription>;
    deposit: (request: import("../../../wallet/index.js").WalletVaultDepositRequest) => import("../../../../index.js").SocketSubscription<import("../../index.js").VaultUpdateSubscription>;
    open: (request: import("../../../wallet/index.js").WalletVaultOpenRequest) => import("../../../../index.js").SocketSubscription<import("../../index.js").VaultOpenSubscription>;
    repay: (request: import("../../../wallet/index.js").WalletVaultRepayRequest) => import("../../../../index.js").SocketSubscription<import("../../index.js").VaultRepaySubscription>;
    repo: (request: import("../../../wallet/index.js").WalletVaultRepoRequest) => import("../../../../index.js").SocketSubscription<import("../../index.js").VaultRepoSubscription>;
    withdraw: (request: import("../../../wallet/index.js").WalletVaultWithdrawRequest) => import("../../../../index.js").SocketSubscription<import("../../index.js").VaultUpdateSubscription>;
};
