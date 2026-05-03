import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../class/client.js';
import type { VaultUpdateSubscription, WalletVaultDepositRequest } from '../../../../types/index.js';
export default function (client: GuardianClient): (request: WalletVaultDepositRequest) => SocketSubscription<VaultUpdateSubscription>;
