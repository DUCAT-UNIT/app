import { GuardianClient } from '../../class/client.js';
export default function (client: GuardianClient): {
    reserve: (request: import("../../index.js").UnitAccountConfig) => import("../../../../index.js").SocketSubscription<import("../../index.js").UnitSubscriptionMap>;
};
