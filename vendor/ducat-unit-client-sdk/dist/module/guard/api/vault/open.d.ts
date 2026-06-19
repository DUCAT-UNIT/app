import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultOpenResponse, VaultOpenRequest } from '@ducat-unit/core';
export declare function open_vault_api(client: GuardianClient): (request: VaultOpenRequest) => SocketSubscription<VaultOpenResponse>;
