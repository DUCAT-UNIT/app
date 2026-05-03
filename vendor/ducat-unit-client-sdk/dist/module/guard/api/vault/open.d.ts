import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../class/client.js';
import type { VaultOpenSubscription, WalletVaultOpenRequest } from '../../../../types/index.js';
export default function (client: GuardianClient): (request: WalletVaultOpenRequest) => SocketSubscription<VaultOpenSubscription>;
