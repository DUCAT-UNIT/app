import { PSBT } from '@ducat-unit/core';
import { ValidationError } from '../../../lib/errors/index.js';
import { child_observe_context, emit_debug, emit_info } from '../../../lib/observe/index.js';
function validate_psbt_structure(psbt) {
    try {
        PSBT.decode_psbt(psbt);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ValidationError(`Invalid PSBT structure: ${message}`);
    }
}
export function sign_psbt_api(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'sign.psbt' });
    const sign_psbt = client.connector.sign.psbt(client);
    return async (psbt) => {
        emit_info(observe, 'wallet.sign.psbt.start', 'signing single PSBT', {
            psbt_length: psbt.length
        });
        validate_psbt_structure(psbt);
        const manifest = await client.fetch.manifest(psbt);
        const signed = await sign_psbt(psbt, manifest);
        emit_debug(observe, 'wallet.sign.psbt.complete', {
            manifest_key_count: Object.keys(manifest).length,
            psbt_length: psbt.length,
            signed_length: signed.length
        });
        return signed;
    };
}
export function sign_batch_api(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'sign.batch' });
    const batch_method = client.connector.sign.batch;
    const sign_batch = (batch_method !== undefined)
        ? batch_method(client)
        : default_batch_method(client);
    return async (psbts) => {
        emit_info(observe, 'wallet.sign.batch.start', 'signing PSBT batch', {
            psbt_count: psbts.length
        });
        const entries = [];
        for (const psbt of psbts) {
            validate_psbt_structure(psbt);
            const manifest = await client.fetch.manifest(psbt);
            entries.push([psbt, manifest]);
        }
        const signed = await sign_batch(entries);
        emit_debug(observe, 'wallet.sign.batch.complete', {
            psbt_count: psbts.length,
            signed_count: signed.length,
            total_psbt_length: psbts.reduce((sum, item) => sum + item.length, 0)
        });
        return signed;
    };
}
function default_batch_method(client) {
    const sign_psbt = client.connector.sign.psbt(client);
    return async (entries) => {
        const signed = [];
        for (const [psbt, manifest] of entries) {
            const signed_psbt = await sign_psbt(psbt, manifest);
            signed.push(signed_psbt);
        }
        return signed;
    };
}
