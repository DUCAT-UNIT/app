import { None } from './monads.js';
export class Cenotaph {
    constructor(flaws, etching = None, mint = None) {
        this.flaws = flaws;
        this.etching = etching;
        this.mint = mint;
        this.type = 'cenotaph';
    }
}
