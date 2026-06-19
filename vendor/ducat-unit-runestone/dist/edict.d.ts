import { Option } from './monads.js';
import { RuneId } from './runeid.js';
import { u128, u32 } from './integer/index.js';
export type Edict = {
    id: RuneId;
    amount: u128;
    output: u32;
};
export declare namespace Edict {
    function fromIntegers(numOutputs: number, id: RuneId, amount: u128, output: u128): Option<Edict>;
}
