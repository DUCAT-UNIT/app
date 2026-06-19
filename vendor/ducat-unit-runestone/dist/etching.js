import { None, Some } from './monads.js';
import { u128 } from './integer/index.js';
export class Etching {
    constructor(divisibility, rune, spacers, symbol, terms, premine, turbo) {
        this.divisibility = divisibility;
        this.rune = rune;
        this.spacers = spacers;
        this.terms = terms;
        this.premine = premine;
        this.turbo = turbo;
        this.symbol = symbol.andThen((value) => {
            const codePoint = value.codePointAt(0);
            return codePoint !== undefined ? Some(String.fromCodePoint(codePoint)) : None;
        });
    }
    get supply() {
        const premine = this.premine.unwrapOr(u128(0));
        const cap = this.terms.andThen((terms) => terms.cap).unwrapOr(u128(0));
        const amount = this.terms.andThen((terms) => terms.amount).unwrapOr(u128(0));
        return u128
            .checkedMultiply(cap, amount)
            .andThen((multiplyResult) => u128.checkedAdd(premine, multiplyResult));
    }
}
