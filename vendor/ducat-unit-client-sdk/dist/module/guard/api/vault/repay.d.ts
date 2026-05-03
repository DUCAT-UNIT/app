import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../class/client.js';
import type { VaultRepaySubscription, WalletVaultRepayRequest } from '../../../../types/index.js';
export default function (client: GuardianClient): (request: WalletVaultRepayRequest) => SocketSubscription<VaultRepaySubscription>;
