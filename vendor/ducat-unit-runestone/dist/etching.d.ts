import { Option } from './monads.js';
import { Terms } from './terms.js';
import { Rune } from './rune.js';
import { u128, u32, u8 } from './integer/index.js';
export declare class Etching {
    readonly divisibility: Option<u8>;
    readonly rune: Option<Rune>;
    readonly spacers: Option<u32>;
    readonly terms: Option<Terms>;
    readonly premine: Option<u128>;
    readonly turbo: boolean;
    readonly symbol: Option<string>;
    constructor(divisibility: Option<u8>, rune: Option<Rune>, spacers: Option<u32>, symbol: Option<string>, terms: Option<Terms>, premine: Option<u128>, turbo: boolean);
    get supply(): Option<u128>;
}
