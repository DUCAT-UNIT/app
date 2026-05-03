import { parse_schema } from '../../../util/index.js';
import Schema from '../../../schema/index.js';
export function parse_liquid_terms(terms) {
    const error = 'liquidation terms failed validation';
    const schema = Schema.proto.liquid_terms;
    return parse_schema(terms, schema, error);
}
export function parse_vault_terms(terms) {
    const error = 'vault terms failed validation';
    const schema = Schema.proto.vault_terms;
    return parse_schema(terms, schema, error);
}
export function parse_vault_open_config(config) {
    const error = 'vault open config failed validation';
    const schema = Schema.vault.config.open_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_borrow_config(config) {
    const error = 'vault borrow config failed validation';
    const schema = Schema.vault.config.borrow_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_repay_config(config) {
    const error = 'vault repay config failed validation';
    const schema = Schema.vault.config.repay_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_deposit_config(config) {
    const error = 'vault deposit config failed validation';
    const schema = Schema.vault.config.deposit_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_withdraw_config(config) {
    const error = 'vault withdraw config failed validation';
    const schema = Schema.vault.config.withdraw_config;
    return parse_schema(config, schema, error);
}
export function parse_vault_open_request(req) {
    const error = 'vault open request failed validation';
    const schema = Schema.vault.req.open_req;
    return parse_schema(req, schema, error);
}
export function parse_vault_borrow_request(req) {
    const error = 'vault borrow request failed validation';
    const schema = Schema.vault.req.borrow_req;
    return parse_schema(req, schema, error);
}
export function parse_vault_repay_request(req) {
    const error = 'vault repay request failed validation';
    const schema = Schema.vault.req.repay_req;
    return parse_schema(req, schema, error);
}
export function parse_vault_deposit_request(req) {
    const error = 'vault deposit request failed validation';
    const schema = Schema.vault.req.deposit_req;
    return parse_schema(req, schema, error);
}
export function parse_vault_withdraw_request(req) {
    const error = 'vault withdraw request failed validation';
    const schema = Schema.vault.req.withdraw_req;
    return parse_schema(req, schema, error);
}
