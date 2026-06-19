import { GuardianClient } from '../../../../module/guard/class/client.js';
import { SocketSubscription } from '../../../../class/socket.js';
import type { VaultBorrowRequest, VaultBorrowResponse } from '@ducat-unit/core';
export declare function borrow_vault_api(client: GuardianClient): (request: VaultBorrowRequest) => SocketSubscription<VaultBorrowResponse>;
