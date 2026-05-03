import { Buff } from '@cmdcode/buff';
import { Assert, TX } from '../../../util/index.js';
import { create_vault_cleared_spend_script, create_vault_fund_conn_script, create_vault_locked_spend_script, create_vault_open_conn_script } from './script.js';
import CONST from '../../../const.js';
export function create_vault_open_conn_out(vault_ctx, fund_value) {
    const scripts = create_vault_open_conn_script(vault_ctx);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(fund_value), script: TX.encode_p2tr_pubkey(tapkey) };
}
export function create_vault_fund_conn_out(vault_ctx, fund_value) {
    const { guard_pubkey, vault_pubkey } = vault_ctx;
    const scripts = create_vault_fund_conn_script(guard_pubkey, vault_pubkey);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(fund_value), script: TX.encode_p2tr_pubkey(tapkey) };
}
export function create_vault_locked_spend_out(guard_pubkey, thold_hash, vault_amount, vault_pubkey) {
    const scripts = create_vault_locked_spend_script(guard_pubkey, thold_hash, vault_pubkey);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: TX.encode_p2tr_pubkey(tapkey) };
}
export function create_vault_cleared_spend_out(guard_pubkey, vault_amount, vault_pubkey) {
    const scripts = create_vault_cleared_spend_script(guard_pubkey, vault_pubkey);
    const tapkey = TX.get_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: TX.encode_p2tr_pubkey(tapkey) };
}
export function create_vault_spend_out(vault_ctx, unit_bal, vault_amt) {
    const { guard_pubkey, vault_quote, vault_pubkey } = vault_ctx;
    const thold_hash = vault_quote.thold_hash;
    return (unit_bal > 0)
        ? create_vault_locked_spend_out(guard_pubkey, thold_hash, vault_amt, vault_pubkey)
        : create_vault_cleared_spend_out(guard_pubkey, vault_amt, vault_pubkey);
}
export function create_reserve_spend_out(liquid_ctx) {
    const { reserve_sats, reserve_pk } = liquid_ctx;
    Assert.ok(reserve_sats > CONST.DUST_LIMIT, 'reserve amount is below dust limit');
    const script = Buff.hex('5120' + reserve_pk);
    return { amount: BigInt(reserve_sats), script };
}
export function create_change_out(vault_ctx, change_amt) {
    const { sats_address } = vault_ctx;
    Assert.ok(change_amt > CONST.DUST_LIMIT, 'change amount is below dust limit');
    const script = TX.parse_address_script(sats_address);
    return { amount: BigInt(change_amt), script };
}
