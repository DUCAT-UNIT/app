import { get_vault_terms } from '@ducat-unit/core/lib';
export function get_unit_asset_id(proto_profile) {
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    return vault_terms.unit_asset_id;
}
