import { parse_psbt } from '../../../psbt/parse.js';
import { parse_tx_data } from '../../../lib/txdata.js';
export function compose_strict_policy(label, run_strict, run_policy) {
    run_strict();
    const flags = run_policy();
    if (flags.length > 0) {
        throw new Error(`${label} [${flags[0].code}]: ${flags[0].detail}`);
    }
}
export function parse_vault_tx_from_psbt(vault_psbt) {
    const pdata = parse_psbt(vault_psbt);
    return parse_tx_data(pdata.hex);
}
export function guard_members_equal(a, b) {
    if (a.length !== b.length)
        return false;
    const sorted_a = [...a].sort();
    const sorted_b = [...b].sort();
    return sorted_a.every((v, i) => v === sorted_b[i]);
}
