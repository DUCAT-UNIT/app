import { WebSocketClient } from '../../../class/socket.js';
import { child_observe_context } from '../../../lib/observe/index.js';
import { get_observe_context } from '../../../lib/observe/index.js';
import { reserve_asset_account_api } from '../../../module/guard/api/asset/reserve.js';
import * as VAULT_API from '../../../module/guard/api/vault/index.js';
export class GuardianClient {
    constructor(host_url, network, options = {}) {
        this._network = network;
        this._observe = get_observe_context(options.observability, {
            module: 'guardian',
            network
        });
        this._socket = new WebSocketClient(host_url, {
            allow_insecure_ws: options.allow_insecure_ws,
            observability: child_observe_context(this.observe, {
                module: 'guardian_socket',
                network,
                socket_url: host_url
            })
        });
    }
    get network() {
        return this._network;
    }
    get observe() {
        return this._observe;
    }
    get request() {
        return {
            asset: {
                reserve: reserve_asset_account_api(this)
            },
            vault: {
                borrow: VAULT_API.borrow_vault_api(this),
                close: VAULT_API.close_vault_api(this),
                deposit: VAULT_API.deposit_vault_api(this),
                open: VAULT_API.open_vault_api(this),
                repay: VAULT_API.repay_vault_api(this),
                repo: VAULT_API.repo_vault_api(this),
                trim: VAULT_API.trim_vault_api(this),
                withdraw: VAULT_API.withdraw_vault_api(this)
            }
        };
    }
    get socket() {
        return this._socket;
    }
    close() {
        this._socket.close();
    }
}
