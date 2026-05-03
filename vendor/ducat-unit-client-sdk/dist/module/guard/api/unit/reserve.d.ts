import { SocketSubscription } from '../../../../class/socket.js';
import { GuardianClient } from '../../class/client.js';
import type { UnitAccountConfig, UnitSubscriptionMap } from '../../../../types/index.js';
export default function (client: GuardianClient): (request: UnitAccountConfig) => SocketSubscription<UnitSubscriptionMap>;
