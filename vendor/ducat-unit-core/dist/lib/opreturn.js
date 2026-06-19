import { Buff } from '@vbyte/buff';
import { OP_RETURN_CODE } from '../const.js';
export function get_op_return_data(script_pk) {
    const bytes = Buff.hex(script_pk);
    const magic = bytes.at(0);
    if (magic === undefined)
        return null;
    if (magic !== OP_RETURN_CODE)
        return null;
    const code = bytes.at(1);
    if (code === undefined)
        return null;
    return { code, script: script_pk };
}
export function find_opreturn_output(vout) {
    return vout.find(vout => vout.type === 'opreturn') ?? null;
}
