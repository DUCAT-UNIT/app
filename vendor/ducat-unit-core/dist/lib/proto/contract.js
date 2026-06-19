import { Buff } from '@vbyte/buff';
import { hash340 } from '@vbyte/crypto/hash';
const ANCHOR_ID_PREFIX = 'ducat/anchor_id';
const BIP340_PREFIX = 'ducat/proto_contract_id';
export function get_anchor_id(anchor_height, anchor_index, anchor_txid) {
    const preimage = Buff.json([
        anchor_height,
        anchor_index,
        anchor_txid
    ]);
    return hash340(ANCHOR_ID_PREFIX, preimage).hex;
}
export function get_proto_contract_id(input) {
    const preimage = Buff.json([
        input.anchor_id,
        input.contract_height,
        input.contract_index,
        input.contract_txid
    ]);
    return hash340(BIP340_PREFIX, preimage).hex;
}
export function create_proto_member_records(data) {
    const profiles = [];
    for (const mbr of data) {
        const [group, idx, pubkey] = mbr;
        profiles.push({ idx, group, pubkey });
    }
    return profiles;
}
export function create_proto_term_records(data) {
    return data.map(term => ({
        group: term[0],
        key: term[1],
        value: term.slice(2)
    }));
}
export function create_proto_template(assets, contract, contract_height, contract_index, contract_txid, chain_height = contract_height) {
    return {
        contract_height,
        contract_index,
        contract_txid,
        chain_height,
        proto_assets: assets,
        proto_members: create_proto_member_records(contract.signers),
        proto_terms: create_proto_term_records(contract.terms)
    };
}
export function create_proto_profile(anchor_data, proto_template) {
    const merged = { ...anchor_data, ...proto_template };
    const contract_id = get_proto_contract_id(merged);
    return { ...merged, contract_id };
}
