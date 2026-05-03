import { parse_error } from '../../../../util/helpers.js';
import CONST from '../../../../const.js';
import Schema from '../../../../schema/index.js';
export default function (client) {
    return (request) => {
        const schema = Schema.guard.acct_reserve_config;
        const config = schema.parse(request);
        const topic = CONST.TOPICS.UNIT_ACCT;
        const sub = client.subscribe(topic);
        sub.register(handler);
        sub.send({ ...config, network: client.network });
        return sub;
    };
}
function handler(sub, msg) {
    try {
        switch (msg.type) {
            case 'info': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('info', parsed);
                break;
            }
            case 'res': {
                const parsed = Schema.guard.acct_reserve_res.parse(msg.data);
                sub.emit('res', parsed);
                break;
            }
            case 'rej': {
                const parsed = Schema.base.str.parse(msg.data);
                sub.emit('rej', parsed);
                break;
            }
        }
    }
    catch (err) {
        const reason = parse_error(err);
        sub.emit('err', reason);
    }
}
