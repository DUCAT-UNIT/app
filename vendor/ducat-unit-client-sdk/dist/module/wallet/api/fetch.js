import { filter_rune_utxos, select_rune_utxos, select_sat_utxos } from '../../../lib/utxo.js';
function fetch_vault_tokens_api(client) {
    const fetch_vault_tokens = client.conn.fetch.vault_tokens(client);
    return async () => {
        const named = new Map();
        const tokens = await fetch_vault_tokens();
        for (const tkn of tokens.values()) {
            named.set(tkn.data.tag, tkn);
        }
        return named;
    };
}
function fetch_balance_api(client) {
    const fetch_balance = client.conn.fetch.balance(client);
    return async () => {
        const balance = fetch_balance();
        return balance;
    };
}
function fetch_sats_utxos_api(client) {
    const fetch_sat_utxos = client.conn.fetch.sats_utxos(client);
    return async (amount) => {
        let utxos = await fetch_sat_utxos();
        if (typeof amount === 'number') {
            utxos = select_sat_utxos(utxos, amount);
        }
        return utxos;
    };
}
function fetch_rune_utxos_api(client) {
    const fetch_rune_utxos = client.conn.fetch.rune_utxos(client);
    return async (rune, amount) => {
        const map = await fetch_rune_utxos();
        let utxos = [...map.values()];
        utxos = filter_rune_utxos(utxos, rune);
        if (typeof amount === 'number') {
            utxos = select_rune_utxos(utxos, rune, amount);
        }
        return utxos;
    };
}
export default (client) => {
    return {
        balance: fetch_balance_api(client),
        sats_utxos: fetch_sats_utxos_api(client),
        rune_utxos: fetch_rune_utxos_api(client),
        vault_tokens: fetch_vault_tokens_api(client)
    };
};
