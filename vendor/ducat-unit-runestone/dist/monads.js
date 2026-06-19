export const OptionType = {
    Some: Symbol(':some'),
    None: Symbol(':none'),
};
class SomeImpl {
    constructor(val) {
        this.val = val;
    }
    get type() {
        return OptionType.Some;
    }
    isSome() {
        return true;
    }
    isNone() {
        return false;
    }
    match(fn) {
        return fn.some(this.val);
    }
    map(fn) {
        return Some(fn(this.val));
    }
    inspect(fn) {
        fn(this.val);
        return this;
    }
    andThen(fn) {
        return fn(this.val);
    }
    or(_optb) {
        return this;
    }
    orElse(_optb) {
        return this;
    }
    and(optb) {
        return optb;
    }
    unwrapOr(_def) {
        return this.val;
    }
    unwrap() {
        return this.val;
    }
}
class NoneImpl {
    get type() {
        return OptionType.None;
    }
    isSome() {
        return false;
    }
    isNone() {
        return true;
    }
    match({ none }) {
        if (typeof none === 'function') {
            return none();
        }
        return none;
    }
    map(_fn) {
        return new NoneImpl();
    }
    inspect(_fn) {
        return this;
    }
    andThen(_fn) {
        return new NoneImpl();
    }
    or(optb) {
        return optb;
    }
    orElse(optb) {
        return optb();
    }
    and(_optb) {
        return new NoneImpl();
    }
    unwrapOr(def) {
        return def;
    }
    unwrap() {
        throw new ReferenceError('Trying to unwrap None.');
    }
}
export function Some(val) {
    return new SomeImpl(val);
}
export const None = new NoneImpl();
export function isSome(val) {
    return val.isSome();
}
export function isNone(val) {
    return val.isNone();
}
