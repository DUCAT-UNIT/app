import { Assert } from '@vbyte/util/assert';
import { assert_consistent_price_stamp } from '../../lib/price/index.js';
export function get_threshold_price(price_quote, base_rate) {
    const { base_price, rate_thold } = price_quote;
    const thold_price = Math.ceil(base_price * rate_thold / base_rate);
    Assert.ok(Number.isInteger(thold_price), 'thold price must be an integer');
    Assert.ok(thold_price > 0, 'thold price must be greater than zero');
    Assert.ok(thold_price < base_price, 'thold price must be less than base price');
    return thold_price;
}
export function get_base_price_config(price_quote) {
    const { base_price, base_stamp, chain_network, oracle_pubkey } = price_quote;
    return { base_price, base_stamp, chain_network, oracle_pubkey };
}
function select_lowest_base_price(items) {
    return items.sort((a, b) => a.base_price - b.base_price).at(0) ?? null;
}
export function select_base_price_quote(price_quotes) {
    if (!price_quotes || price_quotes.length === 0)
        return null;
    assert_consistent_price_stamp(price_quotes);
    return select_lowest_base_price(price_quotes);
}
export function select_base_price_contract(price_contracts) {
    if (!price_contracts || price_contracts.length === 0)
        return null;
    assert_consistent_price_stamp(price_contracts);
    return select_lowest_base_price(price_contracts);
}
export function select_base_price_commit(price_commits) {
    if (price_commits.length === 0)
        return null;
    return select_lowest_base_price(price_commits);
}
