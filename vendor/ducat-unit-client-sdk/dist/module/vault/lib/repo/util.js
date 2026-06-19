import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { hash160 } from '@vbyte/crypto/hash';
import { parse_liquidation_script } from '@ducat-unit/core/lib';
export function find_price_commit_idx(price_commits, thold_key) {
    const ref_hash = hash160(thold_key).hex;
    const idx = price_commits.findIndex(commit => commit.thold_hash === ref_hash);
    return idx !== -1 ? idx : null;
}
export function get_liquid_script_idx(guard_index, thold_count, thold_idx) {
    const COSIGN_SCRIPT_OFFSET = 1;
    return (guard_index * thold_count) + COSIGN_SCRIPT_OFFSET + thold_idx;
}
export function get_price_commit_thold_hash(commits, index) {
    const thold_hash = commits[index].thold_hash;
    Assert.exists(thold_hash, 'thold hash is missing from price commit');
    return Buff.hex(thold_hash);
}
export function get_claimed_sats_amount(liquid_profiles) {
    return liquid_profiles.reduce((acc, profile) => acc + profile.claimed_sats, 0);
}
export function verify_liquid_script(scripts, script_idx, thold_bytes) {
    const script = scripts.at(script_idx);
    Assert.exists(script, `script does not exist at index: ${script_idx}`);
    const thold_hex = Buff.u8a(thold_bytes, 20).hex;
    const parsed_script = parse_liquidation_script(Buff.u8a(script).hex);
    Assert.ok(parsed_script.liquid_hash === thold_hex, 'liquidation script threshold hash mismatch');
}
