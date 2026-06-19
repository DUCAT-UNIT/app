import { P2TR } from '@vbyte/btc-dev/address';
import { Assert } from '@vbyte/util';
import { PSBT } from '@ducat-unit/core';
import { get_asset_account_utxo } from '@ducat-unit/core/lib';
import { assert_dust_limit } from '@ducat-unit/core/validate';
export function create_issue_account_output(vault_ctx) {
    const issue_utxo = get_asset_account_utxo(vault_ctx.issue_account);
    return PSBT.create_psbt_output(issue_utxo);
}
export function create_issue_change_output(vault_ctx) {
    const { issue_account, unit_postage } = vault_ctx;
    Assert.exists(unit_postage, 'unit postage is missing from vault context');
    assert_dust_limit(unit_postage, 'postage is below dust limit');
    const script_pk = issue_account.coin_script;
    return PSBT.create_psbt_output({ value: unit_postage, script_pk });
}
export function create_unit_change_output(vault_ctx) {
    const { unit_address, unit_postage } = vault_ctx;
    Assert.exists(unit_address, 'unit address is missing from vault context');
    Assert.exists(unit_postage, 'unit postage is missing from vault context');
    assert_dust_limit(unit_postage, 'postage is below dust limit');
    const script_pk = P2TR.decode_address(unit_address).script.hex;
    return PSBT.create_psbt_output({ value: unit_postage, script_pk });
}
