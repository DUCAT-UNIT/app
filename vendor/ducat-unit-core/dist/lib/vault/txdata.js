import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { hash160 } from '@vbyte/crypto/hash';
import { decode_vault_commit_data } from './commit.js';
import { OP_RETURN_CODE, OP_RETURN_TYPE, SYMBOLS } from '../../const.js';
import { calc_collateral_ratio, parse_cosigner_script, get_coin_utxo, get_vault_action_vout_idx, parse_witness_commits, parse_tx_data, get_vault_action_label, decode_vault_return_script, parse_liquidation_script, encode_coin_id, get_vault_terms, get_adjusted_unit_price, get_asset_profile } from '../../lib/index.js';
const ACTION_CODES = Object.values(SYMBOLS.CODE.VAULT);
const CONNECT_CODE = SYMBOLS.CODE.INPUT.CONNECT;
const LIQUID_CODE = SYMBOLS.CODE.INPUT.LIQUID;
const RETURN_MAGIC = Buff.join([OP_RETURN_CODE, OP_RETURN_TYPE.VAULT]).hex;
export function extract_vault_ctx(txdata) {
    for (const [idx, input] of txdata.vin.entries()) {
        if (!input.witness.script)
            continue;
        if (input.sequence.type !== 'metadata')
            continue;
        if (!ACTION_CODES.includes(input.sequence.code))
            continue;
        const coin_id = encode_coin_id(txdata.txid, idx);
        const spend_id = input.coin_id;
        const vault_action = get_vault_action_label(input.sequence.code);
        const vault_config = extract_vault_config(txdata);
        const vault_signers = parse_cosigner_script(input.witness.script);
        const vault_vout = get_vault_action_vout_idx(vault_action);
        const vault_utxo = (vault_vout >= 0) ? get_coin_utxo(txdata, vault_vout) : null;
        const vault_version = input.sequence.version;
        if (vault_action !== 'close') {
            Assert.exists(vault_utxo, 'vault utxo is null');
        }
        return { coin_id, spend_id, vault_action, vault_config, vault_input: input, vault_signers, vault_utxo, vault_version };
    }
    return null;
}
export function extract_vault_config(txdata) {
    const wit_commits = parse_witness_commits(txdata);
    const vault_commit = wit_commits.find(c => ACTION_CODES.includes(c.seq_code)) ?? null;
    if (!vault_commit?.content)
        return null;
    return decode_vault_commit_data(vault_commit.content);
}
export function extract_vault_connector_input(txdata) {
    for (const input of txdata.vin) {
        if (input.sequence.type !== 'metadata')
            continue;
        if (input.sequence.code !== CONNECT_CODE)
            continue;
        return input;
    }
    return null;
}
export function extract_vault_ratio(proto_profile, vault_return, vault_utxo) {
    if (!vault_return || !vault_utxo)
        return null;
    if (vault_return.unit_price === null)
        return null;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const unit_profile = get_asset_profile(proto_profile, vault_terms.unit_asset_id);
    const { unit_balance, unit_price } = vault_return;
    const vault_balance = vault_utxo.value - vault_terms.vault_value_min;
    const adj_price = get_adjusted_unit_price(unit_price, unit_profile.div);
    return calc_collateral_ratio(vault_balance, unit_balance, adj_price);
}
export function extract_vault_return_data(proto_profile, proto_txdata) {
    for (const output of proto_txdata.vout) {
        if (output.type !== 'opreturn')
            continue;
        if (!output.script_pk.startsWith(RETURN_MAGIC))
            continue;
        return decode_vault_return_script(proto_profile, output.script_pk);
    }
    return null;
}
export function extract_vault_txdata(proto_profile, proto_txdata) {
    const txdata = (typeof proto_txdata === 'string')
        ? parse_tx_data(proto_txdata)
        : proto_txdata;
    const vault_ctx = extract_vault_ctx(txdata);
    if (!vault_ctx)
        return null;
    const conn_input = extract_vault_connector_input(txdata);
    const vault_return = extract_vault_return_data(proto_profile, txdata);
    if (vault_return === null && vault_ctx.vault_action !== 'close') {
        throw new Error(`extract_vault_txdata: missing vault return data for non-close action '${vault_ctx.vault_action}'`);
    }
    const vault_ratio = extract_vault_ratio(proto_profile, vault_return, vault_ctx.vault_utxo);
    return { ...vault_ctx, conn_input, vault_ratio, vault_return };
}
export function extract_liquid_inputs(proto_txdata) {
    const txdata = (typeof proto_txdata === 'string')
        ? parse_tx_data(proto_txdata)
        : proto_txdata;
    const liquid_inputs = [];
    for (const [idx, input] of txdata.vin.entries()) {
        if (!input.witness.script)
            continue;
        if (input.sequence.type !== 'metadata')
            continue;
        if (input.sequence.code !== LIQUID_CODE)
            continue;
        const liquid_script = parse_liquidation_script(input.witness.script);
        const liquid_utxo = get_coin_utxo(txdata, idx);
        const liquid_version = input.sequence.version;
        Assert.exists(liquid_utxo, 'liquid utxo is null');
        liquid_inputs.push({ liquid_input: input, liquid_script, liquid_utxo, liquid_version });
    }
    return liquid_inputs;
}
export function extract_liquid_thold_key(liquid) {
    const { liquid_input, liquid_script } = liquid;
    const params = liquid_input.witness.params;
    const thold_key = params.find(el => hash160(el).hex === liquid_script.liquid_hash);
    Assert.exists(thold_key, `extract_liquid_thold_key: no witness element hashes to liquid_hash (${liquid_script.liquid_hash})`);
    return thold_key;
}
