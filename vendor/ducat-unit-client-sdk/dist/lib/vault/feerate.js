import { get_sigops_vsize } from './calc.js';
import { FEERATE_TOLERANCE } from '../../const.js';
export function get_effective_vsize(config) {
    const { tx_vsize, sigops_count, package_vsize = 0 } = config;
    const sigops_vsize = get_sigops_vsize(sigops_count);
    return tx_vsize + sigops_vsize + package_vsize;
}
export function get_effective_feerate(fees, config) {
    return fees / get_effective_vsize(config);
}
export function get_min_feerate(txfee_rate, tolerance = 0) {
    const clamped = Math.min(Math.max(tolerance, 0), FEERATE_TOLERANCE);
    return txfee_rate * (1 - clamped);
}
