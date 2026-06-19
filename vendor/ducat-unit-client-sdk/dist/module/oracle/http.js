export async function set_oracle_price(host, price) {
    const url = `${host}/api/price`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price })
    });
    return res.json();
}
export async function check_breaches(host, contracts) {
    const url = `${host}/api/breach`;
    const input = contracts.map(c => ({
        contract_id: c.contract_id,
        commit_hash: c.commit_hash,
        oracle_pk: c.oracle_pubkey,
        thold_price: c.thold_price,
        thold_hash: c.thold_hash
    }));
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts: input })
    });
    return res.json();
}
export async function list_oracle_contracts(host) {
    const url = `${host}/api/contracts`;
    const res = await fetch(url);
    return res.json();
}
