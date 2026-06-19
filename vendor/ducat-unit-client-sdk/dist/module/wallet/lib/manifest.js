import { Buff } from '@vbyte/buff';
import { PSBT } from '@ducat-unit/core';
import { get_psbt_input_code } from '@ducat-unit/core/psbt';
import { child_observe_context, emit_debug, emit_info } from '../../../lib/observe/index.js';
import { is_vault_input, update_manifest } from './util.js';
export function get_psbt_manifest_api(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'fetch.manifest' });
    const connector_method = client.connector.fetch.manifest;
    if (connector_method !== undefined) {
        const fetch_manifest = connector_method(client);
        return async (psbt) => {
            emit_info(observe, 'wallet.fetch.manifest.start', 'deriving wallet signing manifest', {
                psbt_length: psbt.length
            });
            const manifest = await fetch_manifest(psbt);
            emit_debug(observe, 'wallet.fetch.manifest.complete', {
                manifest_key_count: Object.keys(manifest).length,
                psbt_length: psbt.length
            });
            return manifest;
        };
    }
    else {
        return default_fetch_manifest_method(client);
    }
}
function default_fetch_manifest_method(client) {
    const observe = child_observe_context(client.observe, { wallet_module: 'fetch.manifest' });
    const { asset, funds, vault } = client.account;
    return async (psbt) => {
        emit_info(observe, 'wallet.fetch.manifest.start', 'deriving wallet signing manifest', {
            psbt_length: psbt.length
        });
        const pdata = PSBT.decode_psbt(psbt);
        const manifest = {};
        for (let i = 0; i < pdata.inputsLength; i++) {
            const input = pdata.getInput(i);
            const code = get_psbt_input_code(input);
            const prevout = input.witnessUtxo;
            if (prevout === undefined)
                continue;
            if (prevout.script.length < 3)
                continue;
            const script_ver = prevout.script[0];
            const script_key = Buff.u8a(prevout.script.slice(2)).hex;
            if (is_vault_input(code)) {
                const tap_data = input.tapLeafScript?.at(0);
                if (tap_data === undefined)
                    continue;
                const tap_script = Buff.u8a(tap_data[1].slice(0, -1)).hex;
                if (!tap_script.includes(vault.pubkey))
                    continue;
                update_manifest(manifest, vault.address, i);
            }
            else {
                if (script_ver === asset.version && script_key === asset.keydata) {
                    update_manifest(manifest, asset.address, i);
                }
                else if (script_ver === funds.version && script_key === funds.keydata) {
                    update_manifest(manifest, funds.address, i);
                }
            }
        }
        emit_debug(observe, 'wallet.fetch.manifest.complete', {
            input_count: pdata.inputsLength,
            manifest_key_count: Object.keys(manifest).length,
            psbt_length: psbt.length
        });
        return manifest;
    };
}
