import { Test } from '@vbyte/util';
import { VaultError } from '../lib/errors/index.js';
export function calc_script_vsize(script) {
    let size = 0;
    if (script instanceof Uint8Array)
        size = script.length;
    else if (Test.is_hex(script))
        size = script.length / 2;
    else
        throw new VaultError(`invalid script type: ${typeof script}`);
    return Math.ceil(size / 4);
}
