import { Flaw } from './flaw.js';
import { Option } from './monads.js';
import { Rune } from './rune.js';
import { RuneId } from './runeid.js';
export declare class Cenotaph {
    readonly flaws: Flaw[];
    readonly etching: Option<Rune>;
    readonly mint: Option<RuneId>;
    readonly type = "cenotaph";
    constructor(flaws: Flaw[], etching?: Option<Rune>, mint?: Option<RuneId>);
}
