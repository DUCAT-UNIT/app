import { Buff } from '@vbyte/buff';
import { Edict } from './edict.js';
import { Etching } from './etching.js';
import { u128, u32 } from './integer/index.js';
import { Option } from './monads.js';
import { RuneId } from './runeid.js';
import { Artifact } from './artifact.js';
import { Flaw } from './flaw.js';
export declare const MAX_SPACERS = 134217727;
export type RunestoneTx = {
    vout: {
        scriptPubKey: {
            hex: string;
        };
    }[];
};
type Payload = Buff | Flaw;
export declare function isValidPayload(payload: Payload): payload is Buff;
export declare class Runestone {
    readonly mint: Option<RuneId>;
    readonly pointer: Option<u32>;
    readonly edicts: Edict[];
    readonly etching: Option<Etching>;
    readonly type = "runestone";
    constructor(mint: Option<RuneId>, pointer: Option<u32>, edicts: Edict[], etching: Option<Etching>);
    static decipher(transaction: RunestoneTx): Option<Artifact>;
    encipher(): Buff;
    static payload(transaction: RunestoneTx): Option<Payload>;
    static integers(payload: Buff): Option<u128[]>;
}
export {};
