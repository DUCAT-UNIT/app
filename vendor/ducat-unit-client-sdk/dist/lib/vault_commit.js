import { Buff } from '@vbyte/buff';
import { encode_inscriptions } from '@ducat-unit/core/lib';
export function create_vault_commit(proto_profile, vault_config) {
    const content = Buff.json({ lbl: vault_config.label });
    return encode_inscriptions([{
            content: content.hex,
            mimetype: 'application/json',
            protocol: proto_profile.domain_hash
        }]);
}
