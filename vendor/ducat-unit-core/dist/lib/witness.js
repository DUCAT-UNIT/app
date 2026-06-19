import { Buff } from '@vbyte/buff';
import { hash160 } from '@vbyte/crypto/hash';
import { parse_witness } from '@vbyte/btc-dev/witness';
import { decode_script } from '@vbyte/btc-dev/script';
import { Assert, Test } from '@vbyte/util';
import { CBLOCK_VERSION } from '../const.js';
import { decode_inscriptions, has_inscription } from './inscribe.js';
import { assert_commit_id, decode_commit_id, encode_coin_id } from './pointer.js';
export function get_commit_ref(commit_id) {
    assert_commit_id(commit_id);
    const { txid, index } = decode_commit_id(commit_id);
    const uint = Buff.num(index, 4);
    return hash160(txid, uint).hex;
}
export function find_witness_commit(commits, code) {
    return commits.find(c => c.seq_code === code) ?? null;
}
export function parse_witness_commits(txdata) {
    const txid = txdata.txid;
    const commits = [];
    let commit_count = 0;
    for (const [index, vin] of txdata.vin.entries()) {
        const { sequence, witness } = vin;
        if (sequence.type !== 'metadata')
            continue;
        const err = verify_witness_payload(witness);
        if (err !== null)
            continue;
        Assert.exists(witness.script, 'witness script not found');
        if (!has_inscription(witness.script))
            continue;
        const author = parse_author_pubkey(witness.script);
        const envelopes = decode_inscriptions(witness.script);
        for (const env of envelopes) {
            commits.push({
                author,
                coin_id: encode_coin_id(vin.txid, vin.vout),
                coin_index: index,
                content: parse_commit_content(env.content),
                commit_id: get_commit_id(txid, commit_count++),
                commit_ref: env.protocol ?? null,
                mimetype: env.mimetype ?? null,
                seq_code: sequence.code,
                seq_version: sequence.version,
            });
        }
    }
    return commits;
}
export function parse_author_pubkey(script) {
    const keywords = ['OP_CHECKSIG', 'OP_CHECKSIGADD'];
    const script_words = decode_script(script);
    const data_idx = script_words.indexOf('OP_0');
    Assert.ok(data_idx !== -1, 'inscription envelope not found');
    const lock_words = script_words.slice(0, data_idx);
    const opcode_idx = lock_words.findIndex(e => keywords.includes(e));
    Assert.ok(opcode_idx !== -1, 'signature operation not found');
    const pubkey = lock_words.at(opcode_idx - 1);
    Assert.exists(pubkey, 'author public key not found');
    Assert.is_hash(pubkey, 'author public key is not valid');
    return pubkey;
}
export function verify_witness_payload(witness) {
    const wdata = (Array.isArray(witness))
        ? parse_witness(witness)
        : witness;
    if (!Test.exists(wdata.script))
        return 'no script found';
    if (!Test.exists(wdata.cblock))
        return 'no cblock found';
    if (wdata.type !== 'p2ts')
        return 'invalid witness type';
    if (!wdata.cblock.startsWith(CBLOCK_VERSION))
        return 'invalid cblock version';
    return null;
}
function get_commit_id(txid, counter) {
    const commit_id = `${txid}i${counter}`;
    counter++;
    return commit_id;
}
function parse_commit_content(content) {
    return (content !== undefined)
        ? Buff.hex(content).str
        : null;
}
