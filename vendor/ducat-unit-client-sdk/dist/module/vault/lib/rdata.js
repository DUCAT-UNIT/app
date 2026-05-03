import { Buff } from '@cmdcode/buff';
import { Assert, TX } from '../../../util/index.js';
import CONST from '../../../const.js';
const { VDATA_MAX_SIZE, VDATA_MIN_SIZE } = CONST;
export function get_vault_return_data(vault_ctx, unit_bal) {
    return (unit_bal > 0)
        ? get_vault_locked_data(vault_ctx, unit_bal)
        : get_vault_cleared_data(vault_ctx);
}
export function get_vault_cleared_data(vault_ctx) {
    const { vault_action, vault_quote } = vault_ctx;
    const unit_price = vault_quote.quote_price;
    const unit_stamp = vault_quote.quote_stamp;
    return { is_locked: false, unit_balance: 0, unit_price, unit_stamp, vault_action };
}
export function get_vault_locked_data(vault_ctx, unit_balance) {
    const { vault_action, vault_quote } = vault_ctx;
    const { thold_hash, thold_price } = vault_quote;
    const unit_price = vault_quote.quote_price;
    const unit_stamp = vault_quote.quote_stamp;
    return { is_locked: true, thold_hash, thold_price, unit_balance, unit_price, unit_stamp, vault_action };
}
export function get_liquid_vault_return_data(liquid_ctx, vault_ctx) {
    const { liquid_vaults, return_unit } = liquid_ctx;
    const vault_action = vault_ctx.vault_action;
    const liquid_vault = liquid_vaults.at(0);
    Assert.exists(liquid_vault, 'no liquid vaults found');
    const unit_price = liquid_vault.rdata.unit_price;
    const unit_stamp = liquid_vault.rdata.unit_stamp;
    return (return_unit > 0)
        ? { ...liquid_vault.rdata, unit_balance: return_unit, vault_action }
        : { is_locked: false, unit_balance: 0, unit_price, unit_stamp, vault_action };
}
export function create_vault_return(data) {
    const v_byte = Buff.num(1, CONST.VAULT_VERSION);
    const action = Buff.str(data.vault_action, 1);
    const balance = Buff.num(data.unit_balance, 4);
    const quote = Buff.num(data.unit_price, 4);
    const stamp = Buff.num(data.unit_stamp, 4);
    const vreturn = [v_byte, action, balance, quote, stamp];
    if (data.unit_balance > 0) {
        Assert.exists(data.thold_price);
        Assert.exists(data.thold_hash);
        const tprice = Buff.num(data.thold_price, 4);
        const thold = Buff.hex(data.thold_hash, 20);
        vreturn.push(tprice, thold);
    }
    else {
        Assert.ok(data.unit_balance === 0, 'cleared vault data has non-zero balance');
    }
    const payload = Buff.join(vreturn);
    return {
        amount: CONST.BIGINT._0,
        script: TX.encode_script(['OP_RETURN', 'OP_8', payload])
    };
}
export function parse_vault_return(script, version = 1) {
    const words = TX.parse_script_asm(script);
    verify_vault_return(words);
    const ret_data = Buff.hex(words[2]).stream;
    const ret_ver = ret_data.read(1).num;
    Assert.ok(ret_ver === version, `vault return data version mismatch: ${ret_ver} !== ${version}`);
    const vault_action = ret_data.read(1).str;
    const unit_balance = ret_data.read(4).num;
    const unit_price = ret_data.read(4).num;
    const unit_stamp = ret_data.read(4).num;
    let return_data = {
        vault_action, unit_balance, unit_price, unit_stamp, is_locked: false
    };
    if (unit_balance > 0) {
        const thold_price = ret_data.read(4).num;
        const thold_hash = ret_data.read(20).hex;
        return_data = { ...return_data, is_locked: true, thold_price, thold_hash };
    }
    Assert.ok(ret_data.size === 0, 'data remaining in buffer');
    return return_data;
}
function verify_vault_return(script_words) {
    Assert.ok(script_words[0] === 'OP_RETURN', 'vault data does not include OP_RETURN');
    Assert.ok(script_words[1] === 'OP_8', 'vault data does not include OP_8');
    Assert.exists(script_words[2]);
    const bytes = Buff.hex(script_words[2]);
    Assert.ok(bytes.length >= VDATA_MIN_SIZE, `vault data size below min: ${bytes.length} < ${VDATA_MIN_SIZE}`);
    Assert.ok(bytes.length <= VDATA_MAX_SIZE, `vault data size above max: ${bytes.length} > ${VDATA_MAX_SIZE}`);
}
