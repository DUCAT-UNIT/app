import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultBaseResponse, VaultCloseRequest } from '@ducat-unit/core';
export declare function close_vault_api(client: GuardianClient): (request: VaultCloseRequest) => SocketSubscription<VaultBaseResponse>;
