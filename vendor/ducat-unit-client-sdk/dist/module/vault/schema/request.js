import { z } from 'zod';
import { base, chain, vault } from '@ducat-unit/core/schema';
const base_request = z.object({
    borrow_amount: base.uint.optional(),
    chain_network: chain.network,
    change_amount: base.uint.optional(),
    client_pubkey: base.hex32,
    deposit_amount: base.uint.optional(),
    guard_members: base.hex32.array(),
    guard_pubkey: base.hex32,
    contract_id: base.hex32,
    root_txid: base.hex32.optional(),
    sighashes: z.object({
        idx: base.uint,
        sighash: base.hex32,
        sigflag: base.uint
    }).array().optional(),
    vault_action: vault.action,
    vault_config: vault.config.optional(),
    withdraw_amount: base.uint.optional(),
});
export const vault_open = z.object({
    ...base_request.shape,
    borrow_amount: base.uint,
    deposit_amount: base.uint,
    issue_psbt: base.base64,
    issue_txid: base.hex32,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
});
export const vault_borrow = z.object({
    ...base_request.shape,
    borrow_amount: base.uint,
    issue_psbt: base.base64,
    issue_txid: base.hex32,
    root_txid: base.hex32,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
});
export const vault_repay = z.object({
    ...base_request.shape,
    repay_amount: base.uint,
    burn_psbt: base.base64,
    burn_txid: base.hex32,
    root_txid: base.hex32,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
});
export const vault_repo = z.object({
    ...base_request.shape,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
});
export const vault_trim = z.object({
    ...base_request.shape,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
});
export const vault_deposit = z.object({
    ...base_request.shape,
    deposit_amount: base.uint,
    root_txid: base.hex32,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
});
export const vault_withdraw = z.object({
    ...base_request.shape,
    root_txid: base.hex32,
    vault_psbt: base.base64,
    vault_txid: base.hex32,
    withdraw_amount: base.uint
});
export const vault_close = z.object({
    ...base_request.shape,
    root_txid: base.hex32,
    vault_psbt: base.base64,
    vault_txid: base.hex32
});
