import { Assert } from '@vbyte/util/assert';
import { assert_finite_positive } from '../validate/assert.js';
import { FLOAT_PRECISION, SATS_PER_BTC } from '../const.js';
export function trim_float(float_value, precision = FLOAT_PRECISION) {
    return parseFloat(float_value.toFixed(precision));
}
export function calc_ratio(amount, total) {
    assert_finite_positive(amount, 'amount');
    assert_finite_positive(total, 'total');
    Assert.ok(total >= amount, 'total must be greater than amount');
    if (amount === total)
        return 1;
    const ratio = amount / total;
    return trim_float(ratio);
}
export function calc_portion(amount, ratio) {
    const portion = trim_float(amount * ratio);
    return Math.round(portion);
}
export function calc_portion_ceil(amount, ratio) {
    const portion = amount * ratio;
    return Math.ceil(portion);
}
export function convert_sats_to_unit(sats_amount, unit_rate) {
    Assert.ok(sats_amount > 0, 'sats amount must be greater than zero');
    Assert.ok(Number.isSafeInteger(sats_amount), `sats amount exceeds safe integer range: ${sats_amount}`);
    assert_finite_positive(unit_rate, 'unit rate');
    const coin_amt = sats_amount / SATS_PER_BTC;
    const unit_amt = coin_amt * unit_rate;
    return Math.round(unit_amt);
}
export function convert_unit_to_sats(unit_amount, unit_rate) {
    if (unit_amount === 0)
        return 0;
    Assert.ok(unit_amount > 0, 'unit amount must be greater than zero');
    Assert.ok(Number.isSafeInteger(unit_amount), `unit amount exceeds safe integer range: ${unit_amount}`);
    Assert.ok(unit_rate > 0, 'unit rate must be greater than zero');
    const coin_amt = unit_amount / unit_rate;
    const sats_amt = coin_amt * SATS_PER_BTC;
    return Math.round(sats_amt);
}
export function calc_collateral_ratio(sats_amount, unit_amount, unit_rate) {
    if (sats_amount === 0 || unit_amount === 0)
        return 0;
    const collateral_amt = convert_sats_to_unit(sats_amount, unit_rate);
    Assert.ok(collateral_amt > 0, 'collateral amount must be greater than zero');
    Assert.ok(unit_amount > 0, 'unit amount must be greater than zero');
    const collateral_rate = collateral_amt / unit_amount;
    return trim_float(collateral_rate);
}
export function calc_collateral_portion(coll_ratio, unit_amount, unit_rate) {
    const sats_amt = convert_unit_to_sats(unit_amount, unit_rate);
    return calc_portion(sats_amt, coll_ratio);
}
export function get_decimal_count(value) {
    Assert.ok(!Number.isNaN(value), 'value must be a number');
    if (Number.isInteger(value))
        return 0;
    const str = value.toString();
    return str.includes('.') ? str.split('.')[1].length : 0;
}
export function count_steps_scaled(value, base, step_size) {
    const precision = get_decimal_count(step_size);
    const scale = 10 ** precision;
    const value_scaled = Math.round(value * scale);
    const base_scaled = Math.round(base * scale);
    const step_scaled = Math.round(step_size * scale);
    Assert.ok(step_scaled > 0, 'step size must resolve to a positive integer scale');
    return Math.floor((value_scaled - base_scaled) / step_scaled);
}
export function get_bucket_rate(rate_min, step_size, step_count) {
    Assert.ok(Number.isInteger(step_count), 'step count must be an integer');
    Assert.ok(step_count >= 0, 'step count cannot be negative');
    const precision = get_decimal_count(step_size);
    const scale = 10 ** precision;
    const rate_min_scaled = Math.round(rate_min * scale);
    const step_scaled = Math.round(step_size * scale);
    Assert.ok(step_scaled > 0, 'step size must resolve to a positive integer scale');
    return (rate_min_scaled + step_count * step_scaled) / scale;
}
export function floor_to_precision(value, precision) {
    Assert.ok(!Number.isNaN(value), 'value must be a number');
    Assert.ok(Number.isInteger(precision), 'precision must be a positive integer');
    Assert.ok(precision >= 0, 'precision cannot be negative');
    if (precision === 0)
        return Math.floor(value);
    return Math.floor(value * 10 ** precision) / 10 ** precision;
}
export function get_adjusted_unit_price(base_price, divisibility = 0) {
    if (divisibility === 0)
        return base_price;
    const adjusted_price = base_price * (10 ** divisibility);
    return trim_float(adjusted_price, divisibility);
}
export function convert_display_to_smallest(display_amount, divisibility = 0) {
    if (divisibility === 0)
        return Math.round(display_amount);
    const scale_factor = 10 ** divisibility;
    const scaled = display_amount * scale_factor;
    const rounded = Math.round(scaled);
    if (Math.abs(scaled - rounded) > 1e-9) {
        throw new Error(`Amount ${display_amount} has more precision than divisibility ${divisibility} allows`);
    }
    return rounded;
}
export function convert_smallest_to_display(smallest_amount, divisibility = 0) {
    if (divisibility === 0)
        return smallest_amount;
    const scale_factor = 10 ** divisibility;
    return smallest_amount / scale_factor;
}
