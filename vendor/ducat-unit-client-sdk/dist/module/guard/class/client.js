import { SocketSubscription, WebSocketClient } from '../../../class/socket.js';
import unit_req_api from '../api/unit/index.js';
import vault_req_api from '../api/vault/index.js';
export class GuardianClient extends WebSocketClient {
    constructor(host_url, network, pubkey) {
        super(host_url);
        this._network = network;
        this._pubkey = pubkey;
    }
    get network() {
        return this._network;
    }
    get pubkey() {
        return this._pubkey;
    }
    get req() {
        return {
            unit: unit_req_api(this),
            vault: vault_req_api(this)
        };
    }
    subscribe(topic, identifier) {
        return new SocketSubscription(this, topic, identifier);
    }
}
