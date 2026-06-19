import { create_asset_transfer_script } from '@ducat-unit/core/lib';
import { TXMAP } from '../const.js';
import { get_unit_asset_id } from './asset_id.js';
const UNIT_BURN_VOUT = TXMAP.UNIT_REPAY.VOUT.RDATA;
const UNIT_XFER_VOUT = TXMAP.UNIT_ISSUE.VOUT.UNIT;
export function create_asset_issue_return_script(proto_profile, borrow_amount) {
    return create_asset_transfer_script({
        asset_id: get_unit_asset_id(proto_profile),
        amount: borrow_amount,
        output: UNIT_XFER_VOUT
    });
}
export function create_asset_burn_return_script(proto_profile, burn_amount) {
    return create_asset_transfer_script({
        asset_id: get_unit_asset_id(proto_profile),
        amount: burn_amount,
        output: UNIT_BURN_VOUT
    });
}
