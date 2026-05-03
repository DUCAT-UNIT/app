import { Assert, round_to_fixed } from '../util/index.js';
import CONST from '../const.js';
const { FLOAT_PREC, COIN_SIZE } = CONST;
export function calc_portion(amount, percent = 1.0) {
    Assert.ok(percent >= 0 && percent <= 1, 'percent must be between 0 and 1');
    const float_amt = round_to_fixed(amount * percent, FLOAT_PREC);
    return Math.round(float_amt);
}
export function convert_sats_to_btc(sats_amount) {
    return (sats_amount / CONST.COIN_SIZE);
}
export function convert_btc_to_sats(btc_amount) {
    return (btc_amount * CONST.COIN_SIZE);
}
export function convert_sats_to_unit(sats_amount, coin_price) {
    const unit_amt = (sats_amount / COIN_SIZE) * coin_price;
    return Math.round(unit_amt);
}
export function convert_unit_to_sats(unit_amount, coin_price) {
    const sats_amt = (unit_amount / coin_price) * COIN_SIZE;
    return Math.round(sats_amt);
}
export function calc_collateral_ratio(sats_amount, unit_amount, coin_price) {
    const collateral_value = (sats_amount / COIN_SIZE) * coin_price;
    const collateral_rate = (collateral_value / unit_amount);
    return round_to_fixed(collateral_rate, FLOAT_PREC);
}
export function calc_collateral_value(coll_ratio, unit_amount, unit_rate) {
    const sats_amt = convert_unit_to_sats(unit_amount, unit_rate);
    return calc_portion(sats_amt, coll_ratio);
}
