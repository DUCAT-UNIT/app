import { Buff } from '@cmdcode/buff';
import { Assert } from '../../../util/index.js';
import { create_vault_cleared_spend_script, create_vault_fund_conn_script, create_vault_locked_spend_script, create_vault_open_conn_script } from './script.js';
import CONST from '../../../const.js';
import PSBT from '../../../util/psbt.js';
export function create_vault_open_conn_vin(vault_ctx, vault_utxo) {
    const input = PSBT.create.input(vault_utxo);
    const scripts = create_vault_open_conn_script(vault_ctx);
    const tapleaf = PSBT.create.tapscript(scripts, 0);
    return {
        ...input,
        tapLeafScript: [tapleaf],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
export function create_vault_fund_conn_vin(vault_ctx, conn_utxo) {
    const { guard_pubkey, vault_pubkey } = vault_ctx;
    const input = PSBT.create.input(conn_utxo);
    const scripts = create_vault_fund_conn_script(guard_pubkey, vault_pubkey);
    return {
        ...input,
        tapLeafScript: [PSBT.create.tapscript(scripts, 0)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
export function create_vault_cleared_spend_vin(guard_pubkey, vault_pubkey, vault_utxo) {
    const input = PSBT.create.input(vault_utxo);
    const scripts = create_vault_cleared_spend_script(guard_pubkey, vault_pubkey);
    return {
        ...input,
        tapLeafScript: [PSBT.create.tapscript(scripts, 0)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
export function create_vault_locked_spend_vin(guard_pubkey, thold_hash, vault_pubkey, vault_utxo) {
    const input = PSBT.create.input(vault_utxo);
    const scripts = create_vault_locked_spend_script(guard_pubkey, thold_hash, vault_pubkey);
    return {
        ...input,
        tapLeafScript: [PSBT.create.tapscript(scripts, 0)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
export function create_vault_spend_vin(vault_ctx) {
    const { guard_pubkey, vault_quote, vault_balance, vault_pubkey, vault_utxo } = vault_ctx;
    const thold_hash = vault_quote.thold_hash;
    return (vault_balance > 0)
        ? create_vault_locked_spend_vin(guard_pubkey, thold_hash, vault_pubkey, vault_utxo)
        : create_vault_cleared_spend_vin(guard_pubkey, vault_pubkey, vault_utxo);
}
export function create_liquid_spend_vin(vault_ctx, vault_profile) {
    const { rdata, vault_pk, thold_key, utxo } = vault_profile;
    Assert.ok(rdata.is_locked, 'liquid vault is not locked');
    const thold_hash = rdata.thold_hash;
    const scripts = create_vault_locked_spend_script(vault_ctx.guard_pubkey, thold_hash, vault_pk);
    const input = PSBT.create.input(utxo);
    const hlock = PSBT.create.hashlock(thold_hash, thold_key);
    return {
        ...input,
        hash160: [hlock],
        tapLeafScript: [PSBT.create.tapscript(scripts, 1)],
        tapInternalKey: Buff.hex(CONST.UNSPENDABLE_KEY)
    };
}
