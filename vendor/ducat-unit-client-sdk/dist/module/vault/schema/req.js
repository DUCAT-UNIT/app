import { z } from 'zod';
import base from '../../../schema/base.js';
import ord from '../../../schema/ord.js';
import exchange from '../../../module/oracle/schema/quote.js';
import input from './input.js';
import tx from '../../../schema/tx.js';
import vdata from './vdata.js';
const base_req = z.object({
    contract_id: ord.inscribe_id,
    tx_feerate: base.num,
    vault_action: vdata.flags,
    vault_psbt: base.base64.optional(),
    vault_txhex: base.hex.optional(),
    vault_txid: base.hash32,
    vault_pubkey: base.hash32,
    vault_quote: exchange.price_quote
});
const open_req = base_req.extend({
    acct_id: ord.inscribe_id,
    acct_utxo: tx.utxo,
    borrow_amount: base.num,
    connect_input: tx.signed_utxo,
    deposit_amount: base.num,
    sats_address: tx.btc_address,
    sats_inputs: tx.signed_utxo.array(),
    unit_address: base.bech32,
    unit_postage: base.num,
    token_address: base.bech32,
    token_data: vdata.token_data,
    token_postage: base.num,
    issue_psbt: base.base64.optional(),
    issue_txhex: base.hex.optional(),
    issue_txid: base.hex
});
const borrow_req = base_req.extend({
    acct_id: ord.inscribe_id,
    acct_utxo: tx.utxo,
    borrow_amount: base.num,
    connect_input: tx.signed_utxo,
    deposit_amount: base.num,
    issue_psbt: base.base64.optional(),
    issue_txhex: base.hex.optional(),
    issue_txid: base.hex,
    sats_address: tx.btc_address,
    sats_inputs: tx.signed_utxo.array(),
    unit_address: base.bech32,
    unit_postage: base.num,
    vault_input: tx.signed_utxo
});
const repay_req = base_req.extend({
    acct_id: ord.inscribe_id,
    acct_utxo: tx.utxo,
    connect_input: tx.signed_utxo,
    repay_amount: base.num,
    repay_psbt: base.base64.optional(),
    repay_txhex: base.hex.optional(),
    repay_txid: base.hex,
    sats_address: tx.btc_address,
    sats_inputs: tx.signed_utxo.array(),
    unit_inputs: tx.signed_utxo.array(),
    unit_address: base.bech32,
    unit_postage: base.num,
    vault_input: tx.signed_utxo
});
const repo_req = base_req.extend({
    connect_input: tx.signed_utxo,
    deposit_amount: base.num,
    liquid_psbt: base.base64.optional(),
    liquid_txhex: base.hex.optional(),
    liquid_txid: base.hex,
    liquid_inputs: input.liquid_input.array(),
    repo_amount: base.num,
    sats_address: tx.btc_address,
    sats_inputs: tx.signed_utxo.array(),
    vault_input: tx.signed_utxo
});
const deposit_req = base_req.extend({
    deposit_amount: base.num,
    sats_address: tx.btc_address,
    sats_inputs: tx.signed_utxo.array(),
    vault_input: tx.signed_utxo
});
const withdraw_req = base_req.extend({
    change_amount: base.num,
    sats_address: tx.btc_address,
    vault_input: tx.signed_utxo
});
export default {
    borrow_req,
    deposit_req,
    open_req,
    repay_req,
    repo_req,
    withdraw_req
};
