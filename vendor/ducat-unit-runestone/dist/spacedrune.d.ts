import { Rune } from './rune.js';
export declare class SpacedRune {
    readonly rune: Rune;
    readonly spacers: number;
    constructor(rune: Rune, spacers: number);
    static fromString(s: string): SpacedRune;
    toString(): string;
}
