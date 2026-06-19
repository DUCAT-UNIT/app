import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultBaseResponse, VaultWithdrawRequest } from '@ducat-unit/core';
export declare function withdraw_vault_api(client: GuardianClient): (request: VaultWithdrawRequest) => SocketSubscription<VaultBaseResponse>;
