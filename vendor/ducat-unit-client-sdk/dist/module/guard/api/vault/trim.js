import { TOPICS } from '../../../../const.js';
import { child_observe_context, emit_debug, emit_info, emit_warn } from '../../../../lib/observe/index.js';
import { validate_vault_trim_request } from '../../../../module/vault/lib/validate.js';
import * as SCHEMA from '../../../../schema/index.js';
import * as SHARED from '@ducat-unit/core/schema';
export function trim_vault_api(client) {
    return (request) => {
        validate_vault_trim_request(request);
        const msg = { data: request, topic: TOPICS.GUARDIAN.VAULT_TRIM };
        const sub = client.socket.subscribe(msg);
        const observe = child_observe_context(client.observe, {
            contract_id: request.contract_id,
            request_id: sub.id,
            topic: msg.topic,
            vault_action: request.vault_action
        });
        emit_info(observe, 'guardian.request.vault.trim.start', 'created guardian vault trim request', { contract_id: request.contract_id });
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
                    emit_warn(observe, 'guardian.request.vault.trim.reject', 'guardian vault trim request rejected', {
                        reason: parsed
                    });
                    sub.emit('reject', parsed);
                    break;
                }
                case 'result': {
                    const schema = SCHEMA.module.guard.response.vault_trim;
                    const parsed = schema.parse(message.data);
                    emit_debug(observe, 'guardian.request.vault.trim.result', {
                        vault_txid: parsed.vault_txid
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
