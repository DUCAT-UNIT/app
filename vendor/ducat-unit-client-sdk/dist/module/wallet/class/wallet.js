import fetch_api from '../api/fetch.js';
import vault_api from '../api/vault/index.js';
export class VaultWallet {
    constructor(accounts, proto_ctx, connector, config) {
        this._acct = accounts;
        this._conf = config;
        this._conn = connector;
        this._mctx = proto_ctx;
    }
    get acct() {
        return this._acct;
    }
    get config() {
        return this._conf;
    }
    get contract_id() {
        return this._mctx.master_id;
    }
    get network() {
        return this.config.network;
    }
    get conn() {
        return this._conn;
    }
    get ctx() {
        return this._mctx;
    }
    get fetch() {
        return fetch_api(this);
    }
    get sign() {
        return {
            batch: (this.conn.sign.batch !== undefined)
                ? this.conn.sign.batch(this)
                : batch_default(this),
            psbt: this.conn.sign.psbt(this),
            utxos: this.conn.sign.utxos(this)
        };
    }
    get vault() {
        return vault_api(this);
    }
}
function batch_default(client) {
    return async (psbts) => {
        const signed = [];
        for (const [psbt, manifest] of psbts) {
            const signed_psbt = await client.sign.psbt(psbt, manifest);
            signed.push(signed_psbt);
        }
        return signed;
    };
}
