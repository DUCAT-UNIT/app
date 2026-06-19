import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultTrimRequest, VaultBaseResponse } from '@ducat-unit/core';
export declare function trim_vault_api(client: GuardianClient): (request: VaultTrimRequest) => SocketSubscription<VaultBaseResponse>;
