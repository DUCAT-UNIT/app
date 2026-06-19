import * as SCHEMA from '../../../schema/index.js';
export function validate_reserve_account_request(request) {
    SCHEMA.module.guard.request.reserve_acct.parse(request);
}
