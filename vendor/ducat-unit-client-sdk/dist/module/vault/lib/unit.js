import { transfer_runes } from '../../../util/runes.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
export function get_unit_balance(balance_amt, repay_amount) {
    const unit_balance = balance_amt - repay_amount;
    if (unit_balance < 0) {
        throw new Error(`repay amount is greater than unit balance: ${balance_amt} < ${repay_amount}`);
    }
    return unit_balance;
}
export function get_unit_change(input_amount, repay_amount) {
    const change_amt = input_amount - repay_amount;
    if (change_amt < 0) {
        throw new Error(`insufficient unit balance from inputs: ${input_amount} < ${repay_amount}`);
    }
    return change_amt;
}
export function create_unit_output(unit_address, unit_postage) {
    return PSBT.create.payout(unit_postage, unit_address);
}
export function create_unit_rune_data(rune_id, unit_amount, utxo_index) {
    const script = transfer_runes(rune_id, unit_amount, utxo_index);
    return { amount: CONST.BIGINT._0, script };
}
