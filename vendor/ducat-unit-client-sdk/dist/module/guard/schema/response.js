import { z } from 'zod';
import { base } from '@ducat-unit/core/schema';
const vault_update = z.object({
    vault_tx: base.hex,
    vault_txid: base.hex32
});
const asset_issue = vault_update.extend({
    issue_tx: base.hex,
    issue_txid: base.hex32
});
const asset_burn = vault_update.extend({
    burn_tx: base.hex,
    burn_txid: base.hex32
});
export const vault_open = asset_issue;
export const vault_borrow = asset_issue;
export const vault_repay = asset_burn;
export const vault_deposit = vault_update;
export const vault_close = vault_update;
export const vault_withdraw = vault_update;
export const vault_repo = vault_update;
export const vault_trim = vault_update;
