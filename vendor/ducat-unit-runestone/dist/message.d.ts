import { Edict } from './edict.js';
import { Flaw } from './flaw.js';
import { u128 } from './integer/index.js';
export declare class Message {
    readonly flaws: Flaw[];
    readonly edicts: Edict[];
    readonly fields: Map<u128, u128[]>;
    constructor(flaws: Flaw[], edicts: Edict[], fields: Map<u128, u128[]>);
    static fromIntegers(numOutputs: number, payload: u128[]): Message;
}
