import { parse_schema } from '../../../util/index.js';
import Schema from '../../../schema/index.js';
export var WalletParser;
(function (WalletParser) {
    function open_config(config) {
        const error = 'wallet open config failed validation';
        const schema = Schema.wallet.config.open_config;
        return parse_schema(config, schema, error);
    }
    WalletParser.open_config = open_config;
    function borrow_config(config) {
        const error = 'wallet borrow config failed validation';
        const schema = Schema.wallet.config.borrow_config;
        return parse_schema(config, schema, error);
    }
    WalletParser.borrow_config = borrow_config;
    function repay_config(config) {
        const error = 'wallet repay config failed validation';
        const schema = Schema.wallet.config.repay_config;
        return parse_schema(config, schema, error);
    }
    WalletParser.repay_config = repay_config;
    function repo_config(config) {
        const error = 'wallet repo config failed validation';
        const schema = Schema.wallet.config.repo_config;
        return parse_schema(config, schema, error);
    }
    WalletParser.repo_config = repo_config;
    function deposit_config(config) {
        const error = 'wallet deposit config failed validation';
        const schema = Schema.wallet.config.deposit_config;
        return parse_schema(config, schema, error);
    }
    WalletParser.deposit_config = deposit_config;
    function withdraw_config(config) {
        const error = 'wallet withdraw config failed validation';
        const schema = Schema.wallet.config.withdraw_config;
        return parse_schema(config, schema, error);
    }
    WalletParser.withdraw_config = withdraw_config;
})(WalletParser || (WalletParser = {}));
