import { PSBT } from '@ducat-unit/core';
import { create_asset_transfer_script } from '@ducat-unit/core/lib';
import { TXMAP } from '../../../../const.js';
const UNIT_BURN_VOUT = TXMAP.UNIT_REPAY.VOUT.RDATA;
const UNIT_XFER_VOUT = TXMAP.UNIT_ISSUE.VOUT.UNIT;
export function create_unit_issue_runestone(vault_ctx) {
    const { issue_account, unit_balance } = vault_ctx;
    let issue_amount;
    if ('vault_profile' in vault_ctx && vault_ctx.vault_profile) {
        issue_amount = unit_balance - vault_ctx.vault_profile.unit_balance;
    }
    else {
        issue_amount = unit_balance;
    }
    const edict = {
        asset_id: issue_account.asset_id,
        amount: issue_amount,
        output: UNIT_XFER_VOUT
    };
    const script = create_asset_transfer_script(edict);
    return PSBT.create_psbt_output({ value: 0, script_pk: script.hex });
}
export function create_unit_burn_runestone(vault_ctx, route_change = false) {
    const { unit_balance, vault_profile, vault_terms } = vault_ctx;
    const unit_asset_id = vault_terms.unit_asset_id;
    const burn_amount = vault_profile.unit_balance - unit_balance;
    const burn_edict = {
        asset_id: unit_asset_id,
        amount: burn_amount,
        output: UNIT_BURN_VOUT
    };
    const edicts = [burn_edict];
    if (route_change) {
        edicts.push({
            asset_id: unit_asset_id,
            amount: 0,
            output: TXMAP.UNIT_REPAY.VOUT.CHANGE
        });
    }
    const script = create_asset_transfer_script(edicts);
    return PSBT.create_psbt_output({ value: 0, script_pk: script.hex });
}
