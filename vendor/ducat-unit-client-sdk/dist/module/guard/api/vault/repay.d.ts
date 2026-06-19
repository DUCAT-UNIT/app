import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultRepayResponse, VaultRepayRequest } from '@ducat-unit/core';
export declare function repay_vault_api(client: GuardianClient): (request: VaultRepayRequest) => SocketSubscription<VaultRepayResponse>;
