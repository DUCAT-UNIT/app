import { Assert } from '@vbyte/util';
import { get_txsize } from '@vbyte/btc-dev/tx';
import { OP_RETURN_CODE, SYMBOLS } from '@ducat-unit/core/const';
import { emit_warn } from '../../../lib/observe/index.js';
import { calc_collateral_ratio, decode_sequence, select_base_price_commit, verify_price_contract_signature, verify_oracles_authorized, verify_vault_open_strict, eval_vault_open_policy, verify_vault_borrow_strict, eval_vault_borrow_policy, verify_vault_repay_strict, eval_vault_repay_policy, verify_vault_deposit, verify_vault_withdraw_strict, eval_vault_withdraw_policy, verify_vault_close, is_authorized_signer, is_valid_unit_balance } from '@ducat-unit/core/lib';
import { get_adjusted_commit_price } from '../../../lib/vault/util.js';
import { verify_liquidator_vault_transition, verify_liquid_vaults_eligible, verify_liquid_vault_transitions, verify_liquidation_amounts } from './verify_liquidation.js';
import { BIGINT, DUST_LIMIT, OUTPUT_CODES, SIGOPS_CODES } from '../../../const.js';
import { get_effective_feerate, get_effective_vsize, get_min_feerate } from '../../../lib/vault/feerate.js';
const FEERATE_WARN_MULTIPLIER = 1.5;
const FEERATE_ERROR_MULTIPLIER = 3.0;
function reject_on_policy_flags(label, flags) {
    if (flags.length > 0) {
        throw new Error(`${label} [${flags[0].code}]: ${flags[0].detail}`);
    }
}
const CURING_ACTIONS = ['repay', 'deposit'];
export function action_requires_collateral_floor(action) {
    return !CURING_ACTIONS.includes(action);
}
export function verify_vault_request_ctx(vault_ctx) {
    verify_guards_authorized(vault_ctx);
    verify_unit_balance(vault_ctx);
    if (vault_ctx.unit_balance > 0) {
        verify_price_contract_data(vault_ctx);
        verify_price_contract_signatures(vault_ctx);
        verify_price_oracles_authorized(vault_ctx);
        if (action_requires_collateral_floor(vault_ctx.vault_action)) {
            verify_collateral_ratio(vault_ctx);
        }
    }
}
export function verify_guards_authorized(vault_ctx) {
    const { guard_members, proto_profile } = vault_ctx;
    Assert.ok(guard_members.length > 0, 'vault must lock to at least one guardian');
    for (const pubkey of guard_members) {
        Assert.ok(is_authorized_signer(proto_profile, pubkey, SYMBOLS.SIGNER.GUARDIAN), `guardian is not an authorized protocol GUARD-group signer: ${pubkey}`);
    }
}
export function verify_unit_balance(vault_ctx) {
    const { unit_balance, vault_terms } = vault_ctx;
    Assert.ok(is_valid_unit_balance(unit_balance, vault_terms), `vault debt is below protocol minimum: ${unit_balance} < ${vault_terms.unit_balance_min}`);
}
export function verify_price_contract_signatures(vault_ctx) {
    const { price_contracts } = vault_ctx;
    if (!price_contracts || price_contracts.length === 0)
        return;
    for (const contract of price_contracts) {
        verify_price_contract_signature(contract);
    }
}
export function verify_price_oracles_authorized(vault_ctx) {
    const { price_contracts, proto_profile } = vault_ctx;
    if (!price_contracts || price_contracts.length === 0)
        return;
    const oracle_pubkeys = price_contracts.map(c => c.oracle_pubkey);
    verify_oracles_authorized(oracle_pubkeys, proto_profile);
}
export function verify_price_contract_data(vault_ctx) {
    const { price_commits, price_contracts, price_stamp, unit_balance } = vault_ctx;
    if (unit_balance === 0)
        return;
    if (!price_contracts || price_contracts.length === 0) {
        throw new Error('price contracts are missing from the vault context');
    }
    Assert.exists(price_stamp, 'price stamp is missing from the vault context');
    Assert.exists(price_commits, 'price commits are missing from the vault context');
}
export function verify_collateral_ratio(vault_ctx) {
    const { price_commits, proto_profile, unit_balance, vault_balance, vault_terms } = vault_ctx;
    const { vault_ratio_min } = vault_terms;
    const base_commit = select_base_price_commit(price_commits);
    Assert.exists(base_commit, 'base commit is missing from price commits');
    const adjusted_price = get_adjusted_commit_price(proto_profile, base_commit);
    const collateral_ratio = calc_collateral_ratio(vault_balance, unit_balance, adjusted_price);
    Assert.ok(collateral_ratio >= vault_ratio_min, `vault collateral ratio is below protocol minimum: ${collateral_ratio} < ${vault_ratio_min}`);
}
export function verify_psbt_output_integrity(pdata, expected_amounts) {
    Assert.ok(pdata.outputsLength === expected_amounts.length, `PSBT output count mismatch: expected ${expected_amounts.length}, got ${pdata.outputsLength}`);
    for (let idx = 0; idx < expected_amounts.length; idx++) {
        const vout = pdata.getOutput(idx);
        Assert.exists(vout.amount, `amount not set for vout index: ${idx}`);
        Assert.ok(vout.amount === expected_amounts[idx], `PSBT output ${idx} amount mismatch: expected ${expected_amounts[idx]}, got ${vout.amount}`);
    }
}
export function verify_vault_request_psbt(vault_pdata, txfee_rate, options) {
    const { asset_pdata, warn_only_high_fees = false, low_feerate_tolerance = 0, observe } = options ?? {};
    let txin_total = BigInt(0);
    let vout_total = BigInt(0);
    let sig_count = 0;
    for (let idx = 0; idx < vault_pdata.outputsLength; idx++) {
        const vout = vault_pdata.getOutput(idx);
        Assert.exists(vout.amount, `amount not set for vout index: ${idx}`);
        Assert.exists(vout.script, `script key does not exist for vout index: ${idx}`);
        Assert.ok(vout.script.length > 0, `script is empty for vout index: ${idx}`);
        const script_code = vout.script[0];
        Assert.ok(OUTPUT_CODES.includes(script_code), `invalid script code: ${script_code}`);
        if (script_code === OP_RETURN_CODE) {
            Assert.ok(vout.amount === BIGINT._0, `OP_RETURN output amount is not zero: ${vout.amount}`);
        }
        else {
            Assert.ok(vout.amount >= BigInt(DUST_LIMIT), `amount is below the dust limit: ${vout.amount} < ${DUST_LIMIT}`);
            vout_total += vout.amount;
        }
    }
    for (let idx = 0; idx < vault_pdata.inputsLength; idx++) {
        const txin = vault_pdata.getInput(idx);
        Assert.ok(txin.nonWitnessUtxo === undefined, `legacy UTXO is not supported`);
        const amount = txin.witnessUtxo?.amount;
        Assert.exists(amount, `prevout does not exist for txin index: ${idx}`);
        Assert.exists(txin.witnessUtxo?.amount, `amount not set for txin index: ${idx}`);
        txin_total += amount;
        if (!txin.sequence)
            continue;
        const seq_data = decode_sequence(txin.sequence);
        if (seq_data.type !== 'metadata')
            continue;
        if (SIGOPS_CODES.includes(seq_data.code)) {
            sig_count++;
        }
    }
    Assert.ok(txin_total >= vout_total, `spending inputs do not cover outputs: ${txin_total} < ${vout_total}`);
    const txfees_bigint = txin_total - vout_total;
    if (txfee_rate === 0) {
        Assert.ok(txfees_bigint === BigInt(0), `fees are being paid on a zero fee transaction: ${txfees_bigint}`);
    }
    else {
        Assert.ok(txfees_bigint <= BIGINT._MAX, `fees exceed safe integer range: ${txfees_bigint}`);
        const txfees = Number(txfees_bigint);
        const txsize = get_txsize(vault_pdata.hex);
        const issue_vsize = asset_pdata ? get_txsize(asset_pdata.hex).vsize : 0;
        const eff_txsize = get_effective_vsize({
            tx_vsize: txsize.vsize,
            sigops_count: sig_count,
            package_vsize: issue_vsize
        });
        const eff_feerate = get_effective_feerate(txfees, {
            tx_vsize: txsize.vsize,
            sigops_count: sig_count,
            package_vsize: issue_vsize
        });
        const sigops_vsize = eff_txsize - txsize.vsize - issue_vsize;
        const min_feerate = get_min_feerate(txfee_rate, low_feerate_tolerance);
        if (eff_feerate < min_feerate) {
            const pkg_info = asset_pdata ? `, issue_vsize=${issue_vsize}` : '';
            throw new Error(`effective fee rate is below the expected fee rate: ${eff_feerate.toFixed(2)} < ${txfee_rate} (vsize=${txsize.vsize}, sigops_vsize=${sigops_vsize}${pkg_info}, fees=${txfees})`);
        }
        else if (eff_feerate < txfee_rate) {
            const pkg_info = asset_pdata ? `, issue_vsize=${issue_vsize}` : '';
            const message = `effective fee rate is below target but within tolerance: ${eff_feerate.toFixed(2)} < ${txfee_rate} (vsize=${txsize.vsize}, sigops_vsize=${sigops_vsize}${pkg_info}, fees=${txfees})`;
            if (observe)
                emit_warn(observe, 'verify.feerate', message, { eff_feerate, min_feerate, txfee_rate });
        }
        const warn_feerate = txfee_rate * FEERATE_WARN_MULTIPLIER;
        const error_feerate = txfee_rate * FEERATE_ERROR_MULTIPLIER;
        if (eff_feerate > error_feerate) {
            const pkg_info = asset_pdata ? `, issue_vsize=${issue_vsize}` : '';
            const message = `effective fee rate exceeds error threshold: ${eff_feerate.toFixed(2)} > ${error_feerate.toFixed(2)} (${FEERATE_ERROR_MULTIPLIER}x expected) (vsize=${txsize.vsize}, sigops_vsize=${sigops_vsize}${pkg_info}, fees=${txfees})`;
            if (warn_only_high_fees) {
                if (observe)
                    emit_warn(observe, 'verify.feerate', message, { eff_feerate, threshold: error_feerate });
            }
            else {
                throw new Error(message);
            }
        }
        else if (eff_feerate > warn_feerate) {
            const pkg_info = asset_pdata ? `, issue_vsize=${issue_vsize}` : '';
            const message = `effective fee rate exceeds warning threshold: ${eff_feerate.toFixed(2)} > ${warn_feerate.toFixed(2)} (${FEERATE_WARN_MULTIPLIER}x expected) (vsize=${txsize.vsize}, sigops_vsize=${sigops_vsize}${pkg_info}, fees=${txfees})`;
            if (observe)
                emit_warn(observe, 'verify.feerate', message, { eff_feerate, threshold: warn_feerate });
        }
    }
}
function verify_reserve_payout(vault_ctx) {
    const { liquid_profiles, reserve_balance, vault_terms } = vault_ctx;
    const total_reserve = (liquid_profiles ?? []).reduce((sum, profile) => sum + profile.reserve_sats, 0);
    const expected_reserve = (total_reserve >= vault_terms.reserve_sats_min)
        ? total_reserve
        : 0;
    Assert.ok(reserve_balance === expected_reserve, `reserve payout mismatch: ${reserve_balance} !== ${expected_reserve}`);
}
export function verify_vault_action_rules(vault_ctx, vault_txid) {
    const { vault_action } = vault_ctx;
    if (vault_action === 'repo' || vault_action === 'trim') {
        verify_liquidator_vault_transition(vault_ctx);
        verify_liquid_vaults_eligible(vault_ctx.liquid_profiles ?? []);
        verify_liquid_vault_transitions(vault_ctx);
        verify_liquidation_amounts(vault_ctx);
        verify_reserve_payout(vault_ctx);
        return;
    }
    const { client_pubkey, guard_members, guard_pubkey, price_commits, price_stamp, proto_profile, unit_balance, vault_balance, vault_config, vault_profile: prev_profile, vault_terms, vault_version } = vault_ctx;
    let vault_ratio = null;
    let unit_price = null;
    let thold_price = null;
    if (unit_balance > 0 && price_commits && price_commits.length > 0) {
        const base_commit = select_base_price_commit(price_commits);
        if (base_commit) {
            const adjusted_price = get_adjusted_commit_price(proto_profile, base_commit);
            vault_ratio = calc_collateral_ratio(vault_balance, unit_balance, adjusted_price);
            unit_price = base_commit.base_price;
            thold_price = base_commit.thold_price;
        }
    }
    const new_profile = {
        vault_action,
        vault_version,
        guard_members,
        price_commits: price_commits ?? [],
        price_stamp: price_stamp ?? null,
        unit_balance,
        unit_price,
        thold_price,
        coin_id: null,
        client_pubkey,
        contract_id: proto_profile.contract_id,
        guard_pubkey,
        root_txid: prev_profile?.root_txid ?? vault_txid,
        vault_balance,
        vault_config: vault_config ?? null,
        vault_ratio,
        vault_script: null,
        vault_value: (vault_action === 'close')
            ? null
            : (vault_balance + vault_terms.vault_value_min)
    };
    switch (vault_action) {
        case 'open':
            Assert.ok(prev_profile == null, 'open action must not have a previous profile');
            verify_vault_open_strict(proto_profile, new_profile);
            reject_on_policy_flags('verify_vault_open', eval_vault_open_policy(proto_profile, new_profile));
            break;
        case 'borrow':
            Assert.exists(prev_profile, 'borrow action requires a previous profile');
            verify_vault_borrow_strict(proto_profile, new_profile, prev_profile);
            reject_on_policy_flags('verify_vault_borrow', eval_vault_borrow_policy(proto_profile, new_profile, prev_profile));
            break;
        case 'repay':
            Assert.exists(prev_profile, 'repay action requires a previous profile');
            verify_vault_repay_strict(proto_profile, new_profile, prev_profile);
            reject_on_policy_flags('verify_vault_repay', eval_vault_repay_policy(proto_profile, new_profile, prev_profile));
            break;
        case 'deposit':
            Assert.exists(prev_profile, 'deposit action requires a previous profile');
            verify_vault_deposit(proto_profile, new_profile, prev_profile);
            break;
        case 'withdraw':
            Assert.exists(prev_profile, 'withdraw action requires a previous profile');
            verify_vault_withdraw_strict(proto_profile, new_profile, prev_profile);
            reject_on_policy_flags('verify_vault_withdraw', eval_vault_withdraw_policy(proto_profile, new_profile, prev_profile));
            break;
        case 'close':
            Assert.exists(prev_profile, 'close action requires a previous profile');
            verify_vault_close(proto_profile, new_profile, prev_profile);
            break;
        default:
            throw new Error(`unknown vault action: ${vault_action}`);
    }
}
