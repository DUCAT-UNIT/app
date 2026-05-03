import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../class/client.js';
import type { VaultBorrowSubscription, WalletVaultBorrowRequest } from '../../../../types/index.js';
export default function (client: GuardianClient): (request: WalletVaultBorrowRequest) => SocketSubscription<VaultBorrowSubscription>;
