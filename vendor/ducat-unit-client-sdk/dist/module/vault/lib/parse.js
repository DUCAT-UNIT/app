import { parse_schema } from '@ducat-unit/core/validate';
import * as SCHEMA from '../../../schema/index.js';
export function parse_vault_open_config(config) {
    const error = 'vault open config failed validation';
    const schema = SCHEMA.module.vault.config.open_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_borrow_config(config) {
    const error = 'vault borrow config failed validation';
    const schema = SCHEMA.module.vault.config.borrow_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_repay_config(config) {
    const error = 'vault repay config failed validation';
    const schema = SCHEMA.module.vault.config.repay_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_deposit_config(config) {
    const error = 'vault deposit config failed validation';
    const schema = SCHEMA.module.vault.config.deposit_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_withdraw_config(config) {
    const error = 'vault withdraw config failed validation';
    const schema = SCHEMA.module.vault.config.withdraw_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_close_config(config) {
    const error = 'vault close config failed validation';
    const schema = SCHEMA.module.vault.config.close_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_open_request(req) {
    const error = 'vault open request failed validation';
    const schema = SCHEMA.module.vault.request.vault_open;
    return parse_schema(req, schema, error);
}
export function parse_vault_borrow_request(req) {
    const error = 'vault borrow request failed validation';
    const schema = SCHEMA.module.vault.request.vault_borrow;
    return parse_schema(req, schema, error);
}
export function parse_vault_repay_request(req) {
    const error = 'vault repay request failed validation';
    const schema = SCHEMA.module.vault.request.vault_repay;
    return parse_schema(req, schema, error);
}
export function parse_vault_deposit_request(req) {
    const error = 'vault deposit request failed validation';
    const schema = SCHEMA.module.vault.request.vault_deposit;
    return parse_schema(req, schema, error);
}
export function parse_vault_withdraw_request(req) {
    const error = 'vault withdraw request failed validation';
    const schema = SCHEMA.module.vault.request.vault_withdraw;
    return parse_schema(req, schema, error);
}
export function parse_vault_close_request(req) {
    const error = 'vault close request failed validation';
    const schema = SCHEMA.module.vault.request.vault_close;
    return parse_schema(req, schema, error);
}
