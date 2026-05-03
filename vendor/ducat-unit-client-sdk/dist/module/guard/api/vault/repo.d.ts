import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../class/client.js';
import type { VaultRepoSubscription, WalletVaultRepoRequest } from '../../../../types/index.js';
export default function (client: GuardianClient): (request: WalletVaultRepoRequest) => SocketSubscription<VaultRepoSubscription>;
