import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultBaseResponse, VaultDepositRequest } from '@ducat-unit/core';
export declare function deposit_vault_api(client: GuardianClient): (request: VaultDepositRequest) => SocketSubscription<VaultBaseResponse>;
