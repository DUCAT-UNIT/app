import { unique } from '@vbyte/util';
import { assert_schema } from '../../validate/schema.js';
import * as SCHEMA from '../../schema/index.js';
import { VAULT_MAX_GUARD_COUNT, VAULT_MAX_ORACLE_COUNT } from '../../const.js';
import { verify_price_contract_signature } from '../../lib/price/contract.js';
import { extract_vault_price_contracts } from '../../lib/vault/price.js';
export function validate_vault_return_data(return_data) {
    assert_schema(return_data, SCHEMA.vault.rdata, 'validate_vault_return_data: schema validation failed');
}
export function verify_encumbered_vault(return_data) {
    const { unit_balance, price_stamp, unit_price } = return_data;
    if (unit_price === null || unit_price === undefined) {
        throw new Error('verify_encumbered_vault: unit price must be present');
    }
    if (price_stamp === null || price_stamp === undefined) {
        throw new Error('verify_encumbered_vault: price stamp must be present');
    }
    if (unit_balance <= 0) {
        throw new Error('verify_encumbered_vault: unit balance must be greater than zero');
    }
    verify_price_oracle_data(return_data);
}
export function verify_cleared_vault(return_data) {
    const { unit_price, price_stamp, unit_balance, price_commits } = return_data;
    if (unit_price !== null) {
        throw new Error('verify_cleared_vault: unit price must be null');
    }
    if (price_stamp !== null) {
        throw new Error('verify_cleared_vault: price stamp must be null');
    }
    if (unit_balance !== 0) {
        throw new Error('verify_cleared_vault: unit balance must be zero');
    }
    if (!Array.isArray(price_commits)) {
        throw new Error('verify_cleared_vault: price commits must be an array');
    }
    if (price_commits.length !== 0) {
        throw new Error('verify_cleared_vault: price commits must be empty');
    }
}
export function verify_guardian_data(guard_pubkeys) {
    if (guard_pubkeys.length === 0) {
        throw new Error('verify_guardian_data: guardian pubkeys must be non-empty');
    }
    if (guard_pubkeys.length > VAULT_MAX_GUARD_COUNT) {
        throw new Error(`verify_guardian_data: guardian count exceeds maximum (${guard_pubkeys.length} > ${VAULT_MAX_GUARD_COUNT})`);
    }
    const unique_keys = unique(guard_pubkeys);
    if (unique_keys.length !== guard_pubkeys.length) {
        throw new Error(`verify_guardian_data: duplicate guardian pubkeys found (${guard_pubkeys.length - unique_keys.length} duplicates)`);
    }
}
export function verify_price_oracle_data(return_data) {
    const { price_commits } = return_data;
    if (price_commits.length === 0) {
        throw new Error('verify_price_oracle_data: price commits must be non-empty');
    }
    if (price_commits.length > VAULT_MAX_ORACLE_COUNT) {
        throw new Error(`verify_price_oracle_data: price commit count exceeds maximum (${price_commits.length} > ${VAULT_MAX_ORACLE_COUNT})`);
    }
    const oracle_pubkeys = price_commits.map(c => c.oracle_pubkey);
    const unique_oracles = unique(oracle_pubkeys);
    if (unique_oracles.length !== oracle_pubkeys.length) {
        throw new Error(`verify_price_oracle_data: duplicate oracle pubkeys found (${oracle_pubkeys.length - unique_oracles.length} duplicates)`);
    }
}
export function verify_vault_balance(vault_value, min_value) {
    const balance = vault_value - min_value;
    if (balance < 0) {
        throw new Error(`verify_vault_balance: balance cannot be negative (${vault_value} - ${min_value} = ${balance})`);
    }
}
export function verify_borrow_limits(vault_ratio, rate_min) {
    if (vault_ratio !== null && vault_ratio < rate_min) {
        throw new Error(`verify_borrow_limits: would exceed maximum leverage (ratio ${vault_ratio} < min ${rate_min})`);
    }
}
export function verify_withdrawal_limits(vault_ratio, rate_min) {
    if (vault_ratio !== null && vault_ratio < rate_min) {
        throw new Error(`verify_withdrawal_limits: would break collateral ratio (ratio ${vault_ratio} < min ${rate_min})`);
    }
}
export function verify_price_commit_signatures(vault_return, proto_profile) {
    const { price_commits } = vault_return;
    if (price_commits.length === 0)
        return;
    const contracts = extract_vault_price_contracts(proto_profile, vault_return);
    for (const contract of contracts) {
        verify_price_contract_signature(contract);
    }
}
