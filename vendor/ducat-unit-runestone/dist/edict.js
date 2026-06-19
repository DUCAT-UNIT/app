import { Some, None } from './monads.js';
import { u128 } from './integer/index.js';
export var Edict;
(function (Edict) {
    function fromIntegers(numOutputs, id, amount, output) {
        if (id.block === 0n && id.tx > 0n) {
            return None;
        }
        const optionOutputU32 = u128.tryIntoU32(output);
        if (optionOutputU32.isNone()) {
            return None;
        }
        const outputU32 = optionOutputU32.unwrap();
        if (outputU32 > numOutputs) {
            return None;
        }
        return Some({ id, amount, output: outputU32 });
    }
    Edict.fromIntegers = fromIntegers;
})(Edict || (Edict = {}));
