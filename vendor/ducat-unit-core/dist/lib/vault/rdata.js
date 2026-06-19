import { Buff, Stream } from '@vbyte/buff';
import { Assert } from '@vbyte/util/assert';
import { decode_script, encode_script } from '@vbyte/btc-dev/script';
import { select_base_price_commit, encode_price_commits, decode_price_commits, resolve_guardian_pubkeys, resolve_guardian_indices } from '../../lib/index.js';
import { VAULT_RETURN_CODE, VAULT_RETURN_VERSION } from '../../const.js';
import { validate_vault_return_data, verify_encumbered_vault, verify_guardian_data } from './validate.js';
export const DEFAULT_RETURN_DATA = () => {
    return {
        guard_members: [],
        price_commits: [],
        price_stamp: null,
        unit_balance: 0,
        unit_price: null,
        thold_price: null
    };
};
export function encode_vault_return_script(proto_profile, return_data) {
    const { guard_members, unit_balance, price_commits } = return_data;
    validate_vault_return_data(return_data);
    verify_guardian_data(guard_members);
    const payload = [Buff.num(VAULT_RETURN_VERSION, 1)];
    payload.push(encode_guardian_indices(proto_profile, guard_members));
    if (unit_balance > 0) {
        verify_encumbered_vault(return_data);
        const { unit_balance, price_stamp } = return_data;
        payload.push(Buff.num(unit_balance, 4));
        payload.push(Buff.num(price_stamp, 4));
        payload.push(encode_price_commits(proto_profile, price_commits));
    }
    return encode_script(['OP_RETURN', VAULT_RETURN_CODE, Buff.join(payload)]);
}
export function decode_vault_return_script(proto_profile, return_script) {
    const [opcode, magic, payload] = decode_script(return_script);
    Assert.ok(opcode === 'OP_RETURN', 'vault data does not include OP_RETURN');
    Assert.ok(magic === 'OP_8', 'vault data does not include OP_8');
    const stream = new Stream(payload);
    const version = stream.read(1).num;
    Assert.ok(version === VAULT_RETURN_VERSION, `vault return data version mismatch: ${version} !== ${VAULT_RETURN_VERSION}`);
    const guard_members = extract_guardian_pubkeys(proto_profile, stream);
    verify_guardian_data(guard_members);
    if (stream.size === 0) {
        return { ...DEFAULT_RETURN_DATA(), guard_members };
    }
    else {
        const unit_balance = stream.read(4).num;
        const price_stamp = stream.read(4).num;
        const price_commits = decode_price_commits(proto_profile, stream);
        const base_commit = select_base_price_commit(price_commits);
        Assert.exists(base_commit, 'no base price commit found');
        const unit_price = base_commit.base_price;
        const thold_price = base_commit.thold_price;
        const return_data = { guard_members, unit_balance, price_stamp, price_commits, unit_price, thold_price };
        validate_vault_return_data(return_data);
        verify_encumbered_vault(return_data);
        return return_data;
    }
}
export function encode_guardian_indices(proto_profile, guard_pubkeys) {
    const records = resolve_guardian_pubkeys(proto_profile, guard_pubkeys);
    const payload = [Buff.num(records.length, 1)];
    for (const mbr of records) {
        payload.push(Buff.num(mbr.idx, 1));
    }
    return Buff.join(payload);
}
export function extract_guardian_pubkeys(proto_profile, data_stream) {
    const count = data_stream.read(1).num;
    Assert.ok(count > 0, `guardian indices must be non-empty`);
    const indices = [];
    for (let i = 0; i < count; i++) {
        const idx = data_stream.read(1).num;
        indices.push(idx);
    }
    Assert.ok(indices.length === count, `guardian indices count mismatch: ${indices.length} !== ${count}`);
    const records = resolve_guardian_indices(proto_profile, indices);
    return records.map(m => m.pubkey);
}
export function get_vault_profile_return_data(vault_profile) {
    const { guard_members, unit_price, thold_price, price_stamp, price_commits, unit_balance } = vault_profile;
    return { guard_members, unit_price, thold_price, price_stamp, price_commits, unit_balance };
}
