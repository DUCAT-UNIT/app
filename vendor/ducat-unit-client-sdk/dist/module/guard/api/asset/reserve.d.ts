import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../../../module/guard/class/client.js';
import type { AssetAccountRequest } from '../../../../types/index.js';
import type { AssetAccount } from '@ducat-unit/core';
export declare function reserve_asset_account_api(client: GuardianClient): (request: AssetAccountRequest) => SocketSubscription<AssetAccount>;
