import { format_zod_error } from './errors.js';
import * as Schema from '../schema/index.js';
export function validate_asset_account(data) {
    const result = Schema.asset.account.safeParse(data);
    if (!result.success) {
        throw new Error(format_zod_error(result.error, 'validate_asset_account'));
    }
}
export function validate_proto_profile(profile) {
    const result = Schema.proto.profile.safeParse(profile);
    if (!result.success) {
        throw new Error(format_zod_error(result.error, 'validate_proto_profile'));
    }
}
export function validate_vault_profile(profile) {
    const result = Schema.vault.profile.safeParse(profile);
    if (!result.success) {
        throw new Error(format_zod_error(result.error, 'validate_vault_profile'));
    }
}
