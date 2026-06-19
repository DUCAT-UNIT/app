import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultRepoRequest, VaultBaseResponse } from '@ducat-unit/core';
export declare function repo_vault_api(client: GuardianClient): (request: VaultRepoRequest) => SocketSubscription<VaultBaseResponse>;
