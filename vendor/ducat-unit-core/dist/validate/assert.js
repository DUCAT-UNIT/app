import { Assert } from '@vbyte/util/assert';
import { verify_pubkey } from '@vbyte/crypto/ecc';
import { DUST_LIMIT } from '../const.js';
export function assert_dust_limit(amount, message) {
    const msg = message ?? `amount must be greater than dust limit`;
    Assert.ok(amount >= DUST_LIMIT, msg);
}
export function assert_bip340_pubkey(pubkey) {
    Assert.is_hash(pubkey, `invalid pubkey format: ${pubkey}`);
    verify_pubkey(pubkey, 'bip340');
}
export function assert_safe_integer(value, name) {
    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be finite`);
    }
    if (!Number.isSafeInteger(value)) {
        throw new Error(`${name} exceeds safe integer range: ${value}`);
    }
}
export function assert_finite(value, name) {
    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be finite, got: ${value}`);
    }
}
export function assert_positive(value, name) {
    if (value <= 0) {
        throw new Error(`${name} must be positive, got: ${value}`);
    }
}
export function assert_finite_positive(value, name) {
    Assert.ok(Number.isFinite(value) && value > 0, `${name} must be a finite positive number: ${value}`);
}
export function assert_nonnegative(value, name) {
    if (value < 0) {
        throw new Error(`${name} must be non-negative, got: ${value}`);
    }
}
