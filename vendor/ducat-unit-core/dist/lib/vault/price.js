import { Buff, Stream } from '@vbyte/buff';
import { Assert } from '@vbyte/util/assert';
import { PRICE_COMMIT_SIZE } from '../../const.js';
import { sort } from '@vbyte/util/obj';
import { get_oracle_records, get_price_contract_commit_hash, get_price_contract_id, find_oracle_record_by_idx, find_oracle_record_by_pubkey } from '../../lib/index.js';
export function create_price_commits(price_contracts) {
    return price_contracts.map((contract) => {
        const { base_price, thold_hash, thold_price, oracle_sig, oracle_pubkey } = contract;
        return { base_price, oracle_pubkey, oracle_sig, thold_hash, thold_price };
    });
}
export function encode_price_commits(proto_profile, price_commits) {
    const oracle_records = get_oracle_records(proto_profile);
    const payload = [Buff.num(price_commits.length, 1)];
    for (const commit of price_commits) {
        const record = find_oracle_record_by_pubkey(oracle_records, commit.oracle_pubkey);
        payload.push(Buff.num(record.idx, 1));
        payload.push(Buff.num(commit.base_price, 4));
        payload.push(Buff.num(commit.thold_price, 4));
        payload.push(Buff.hex(commit.thold_hash, 20));
        payload.push(Buff.hex(commit.oracle_sig, 64));
    }
    return Buff.join(payload);
}
export function decode_price_commits(proto_profile, commit_payload) {
    const oracle_records = get_oracle_records(proto_profile);
    const stream = (commit_payload instanceof Stream)
        ? commit_payload
        : new Stream(commit_payload);
    Assert.ok(stream.size > 0, `invalid price commits payload: size is zero`);
    const count = stream.read(1).num;
    Assert.ok(count > 0, `no price commits found`);
    Assert.ok(stream.size === (PRICE_COMMIT_SIZE * count), `invalid byte count for price commits: ${stream.size} !== ${PRICE_COMMIT_SIZE * count}`);
    const commits = [];
    for (let i = 0; i < count; i++) {
        const oracle_idx = stream.read(1).num;
        const base_price = stream.read(4).num;
        const thold_price = stream.read(4).num;
        const thold_hash = stream.read(20).hex;
        const oracle_sig = stream.read(64).hex;
        const record = find_oracle_record_by_idx(oracle_records, oracle_idx);
        commits.push({ base_price, oracle_pubkey: record.pubkey, oracle_sig, thold_hash, thold_price });
    }
    return commits;
}
export function extract_vault_price_contracts(proto_profile, vault_return) {
    const { price_commits, price_stamp } = vault_return;
    if (price_commits.length === 0)
        return [];
    Assert.exists(price_stamp, 'extract_vault_price_contracts: price_stamp must exist when price_commits is non-empty');
    const chain_network = proto_profile.chain_network;
    return price_commits.map((commit) => {
        const { base_price, oracle_pubkey, oracle_sig, thold_hash, thold_price } = commit;
        const price_config = { base_price, base_stamp: price_stamp, chain_network, oracle_pubkey };
        const commit_hash = get_price_contract_commit_hash(price_config, thold_price);
        const contract_id = get_price_contract_id(commit_hash, thold_hash);
        return sort({ ...price_config, commit_hash, contract_id, oracle_sig, thold_hash, thold_key: null, thold_price });
    });
}
