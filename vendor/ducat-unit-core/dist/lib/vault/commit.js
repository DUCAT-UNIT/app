import { Buff } from '@vbyte/buff';
import * as SCHEMA from '../../schema/index.js';
import { Assert, JsonUtil } from '@vbyte/util';
export function encode_vault_commit_data(vault_config) {
    validate_vault_config_data(vault_config);
    return Buff.json({
        lbl: vault_config.label
    });
}
export function decode_vault_commit_data(payload) {
    const json = JsonUtil.parse(payload);
    Assert.exists(json, 'failed to deserialize vault config data');
    validate_vault_config_payload(json);
    return {
        label: json.lbl
    };
}
export function validate_vault_config_data(config) {
    SCHEMA.vault.config.parse(config);
}
export function validate_vault_config_payload(data) {
    SCHEMA.vault.commit.parse(data);
}
