import { child_observe_context, emit_debug, emit_info, emit_warn } from '../../../../lib/observe/index.js';
import { TOPICS } from '../../../../const.js';
import * as SHARED from '@ducat-unit/core/schema';
import { validate_reserve_account_request } from '../../../../module/guard/lib/validate.js';
export function reserve_asset_account_api(client) {
    return (request) => {
        validate_reserve_account_request(request);
        const msg = { data: request, topic: TOPICS.GUARDIAN.ASSET_RESERVE };
        const sub = client.socket.subscribe(msg);
        const observe = child_observe_context(client.observe, {
            request_id: sub.id,
            topic: msg.topic
        });
        emit_info(observe, 'guardian.request.asset.reserve.start', 'created guardian asset reserve request', { asset_amount: request.asset_amount, asset_id: request.asset_id });
        sub.on('message', (message) => {
            switch (message.type) {
                case 'info': {
                    const parsed = SHARED.base.str.parse(message.data);
                    emit_info(observe, 'guardian.request.subscription.info', parsed);
                    sub.emit('info', parsed);
                    break;
                }
                case 'reject': {
                    const parsed = SHARED.base.str.parse(message.data);
                    emit_warn(observe, 'guardian.request.asset.reserve.reject', 'guardian asset reserve request rejected', {
                        reason: parsed
                    });
                    sub.emit('reject', parsed);
                    break;
                }
                case 'result': {
                    const parsed = SHARED.asset.account.parse(message.data);
                    emit_debug(observe, 'guardian.request.asset.reserve.result', {
                        asset_balance: parsed.asset_balance,
                        asset_id: parsed.asset_id
                    });
                    sub.emit('result', parsed);
                    break;
                }
                case 'status': {
                    const parsed = SHARED.base.str.parse(message.data);
                    emit_info(observe, 'guardian.request.subscription.status', parsed);
                    sub.emit('status', parsed);
                    break;
                }
            }
        });
        return sub;
    };
}
