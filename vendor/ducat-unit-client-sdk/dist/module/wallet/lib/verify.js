import Schema from '../../../schema/index.js';
export function verify_vault_open_config(config) {
    const schema = Schema.wallet.config.open_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault open config failed schema validation');
    }
}
export function verify_vault_borrow_config(config) {
    const schema = Schema.wallet.config.borrow_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault borrow config failed schema validation');
    }
}
export function verify_vault_repay_config(config) {
    const schema = Schema.wallet.config.repay_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault repay config failed schema validation');
    }
}
export function verify_vault_deposit_config(config) {
    const schema = Schema.wallet.config.deposit_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault deposit config failed schema validation');
    }
}
export function verify_vault_withdraw_config(config) {
    const schema = Schema.wallet.config.withdraw_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault withdraw config failed schema validation');
    }
}
export function verify_vault_repo_config(config) {
    const schema = Schema.wallet.config.repo_config;
    const result = schema.safeParse(config);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault repo config failed schema validation');
    }
}
