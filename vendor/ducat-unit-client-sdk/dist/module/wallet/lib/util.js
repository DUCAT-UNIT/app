import { SYMBOLS } from '@ducat-unit/core/const';
const PROTO_ASSETS = Object.values(SYMBOLS.CODE.ASSET);
const VAULT_ACTIONS = Object.values(SYMBOLS.CODE.VAULT);
const CONNECT_INPUT = SYMBOLS.CODE.INPUT.CONNECT;
export function is_asset_input(code) {
    return code !== null && PROTO_ASSETS.includes(code);
}
export function is_vault_input(code) {
    return code !== null && (VAULT_ACTIONS.includes(code) || CONNECT_INPUT === code);
}
export function create_manifest(inputs) {
    const manifest = {};
    for (const [key, value] of inputs) {
        if (manifest[key] === undefined) {
            manifest[key] = [];
        }
        manifest[key].push(...value);
    }
    return manifest;
}
export function update_manifest(manifest, address, index) {
    if (!Array.isArray(manifest[address])) {
        manifest[address] = [index];
    }
    else {
        manifest[address].push(index);
    }
}
