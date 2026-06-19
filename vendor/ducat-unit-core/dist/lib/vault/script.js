import { Assert } from '@vbyte/util';
export function get_liquid_script_idx(guard_index, thold_count, thold_idx) {
    Assert.ok(guard_index >= 0, `get_liquid_script_idx: guard_index must be >= 0 (got ${guard_index})`);
    Assert.ok(thold_count >= 1, `get_liquid_script_idx: thold_count must be >= 1 (got ${thold_count})`);
    Assert.ok(thold_idx >= 0 && thold_idx < thold_count, `get_liquid_script_idx: thold_idx must satisfy 0 <= idx < thold_count ` +
        `(got idx=${thold_idx}, count=${thold_count})`);
    return guard_index * (1 + thold_count) + 1 + thold_idx;
}
