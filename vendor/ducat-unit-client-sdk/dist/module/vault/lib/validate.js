import * as SCHEMA from '../../../schema/index.js';
import { assert_valid } from '../../../lib/validate/core.js';
export function validate_vault_open_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.open_config, req_config, 'vault open config');
}
export function validate_vault_borrow_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.borrow_config, req_config, 'vault borrow config');
}
export function validate_vault_repay_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.repay_config, req_config, 'vault repay config');
}
export function validate_vault_deposit_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.deposit_config, req_config, 'vault deposit config');
}
export function validate_vault_withdraw_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.withdraw_config, req_config, 'vault withdraw config');
}
export function validate_vault_close_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.close_config, req_config, 'vault close config');
}
export function validate_vault_repo_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.repo_config, req_config, 'vault repo config');
}
export function validate_vault_trim_config(req_config) {
    assert_valid(SCHEMA.module.vault.config.trim_config, req_config, 'vault trim config');
}
export function validate_vault_open_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_open, request, 'vault open request');
}
export function validate_vault_borrow_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_borrow, request, 'vault borrow request');
}
export function validate_vault_repay_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_repay, request, 'vault repay request');
}
export function validate_vault_deposit_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_deposit, request, 'vault deposit request');
}
export function validate_vault_withdraw_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_withdraw, request, 'vault withdraw request');
}
export function validate_vault_close_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_close, request, 'vault close request');
}
export function validate_vault_repo_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_repo, request, 'vault repo request');
}
export function validate_vault_trim_request(request) {
    assert_valid(SCHEMA.module.vault.request.vault_trim, request, 'vault trim request');
}
