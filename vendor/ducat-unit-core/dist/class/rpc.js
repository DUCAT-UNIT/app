function is_loopback_host(hostname) {
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '[::1]'
        || hostname === '::1'
        || hostname.endsWith('.localhost');
}
function assert_rpc_url_secure(rpc_url, allow_insecure) {
    let url;
    try {
        url = new URL(rpc_url);
    }
    catch {
        throw new Error(`RpcClient: invalid rpc_url '${rpc_url}'`);
    }
    if (url.protocol === 'https:')
        return;
    if (url.protocol === 'http:') {
        if (is_loopback_host(url.hostname) || allow_insecure)
            return;
        throw new Error(`RpcClient: refusing to send credentials over plaintext http to non-loopback host ` +
            `'${url.hostname}'. Use https, a loopback host, or set allow_insecure: true.`);
    }
    throw new Error(`RpcClient: unsupported rpc_url protocol '${url.protocol}'`);
}
export class RpcClient {
    constructor(config) {
        assert_rpc_url_secure(config.rpc_url, config.allow_insecure ?? false);
        this._config = config;
    }
    async call(method, params = []) {
        try {
            const { rpc_url, rpc_user, rpc_pass } = this._config;
            const auth = Buffer.from(`${rpc_user}:${rpc_pass}`).toString('base64');
            const response = await fetch(rpc_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify({
                    jsonrpc: '1.0',
                    id: Date.now(),
                    method,
                    params
                })
            });
            if (!response.ok) {
                return {
                    ok: false,
                    error: `RPC request failed: ${response.status} ${response.statusText}`
                };
            }
            const data = await response.json();
            if (data.error !== null) {
                return { ok: false, error: data.error.message };
            }
            return { ok: true, data: data.result };
        }
        catch (err) {
            const error = err;
            return { ok: false, error: error.message };
        }
    }
    async _call(method, params = []) {
        const res = await this.call(method, params);
        if (!res.ok)
            throw new Error(res.error);
        return res.data;
    }
    async get_block_count() {
        return this._call('getblockcount');
    }
    async get_block_hash(height) {
        return this._call('getblockhash', [height]);
    }
    async get_block(hash, verbosity = 3) {
        return this._call('getblock', [hash, verbosity]);
    }
    async get_raw_transaction(txid, verbose = true) {
        return this._call('getrawtransaction', [txid, verbose]);
    }
    async send_raw_transaction(hex) {
        return this._call('sendrawtransaction', [hex]);
    }
    async test_mempool_accept(rawtxs) {
        return this._call('testmempoolaccept', [rawtxs]);
    }
    async submit_package(rawtxs) {
        return this._call('submitpackage', [rawtxs]);
    }
    async scan_tx_outset(action, scanobjects) {
        return this._call('scantxoutset', [action, scanobjects]);
    }
    async list_unspent(minconf = 1, maxconf = 9999999, addresses = []) {
        return this._call('listunspent', [
            minconf,
            maxconf,
            addresses
        ]);
    }
    async get_mempool_info() {
        return this._call('getmempoolinfo');
    }
    async get_network_info() {
        return this._call('getnetworkinfo');
    }
    async estimate_smart_fee(conf_target, estimate_mode = 'conservative') {
        return this._call('estimatesmartfee', [
            conf_target,
            estimate_mode.toUpperCase()
        ]);
    }
    async decode_raw_transaction(hex) {
        return this._call('decoderawtransaction', [hex]);
    }
}
