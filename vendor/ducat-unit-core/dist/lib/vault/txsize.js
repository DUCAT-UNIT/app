import { SIGCOUNT } from '../../const.js';
export function get_vault_action_sigops_count(vault_action) {
    switch (vault_action) {
        case 'open': return SIGCOUNT.VAULT_OPEN;
        case 'borrow': return SIGCOUNT.VAULT_BORROW;
        case 'repay': return SIGCOUNT.VAULT_REPAY;
        case 'close': return SIGCOUNT.VAULT_CLOSE;
        case 'repo': return SIGCOUNT.VAULT_REPO;
        case 'trim': return SIGCOUNT.VAULT_TRIM;
        case 'deposit': return SIGCOUNT.VAULT_DEPOSIT;
        case 'withdraw': return SIGCOUNT.VAULT_WITHDRAW;
        case 'liquidate': return SIGCOUNT.VAULT_LIQUIDATE;
        default: {
            const _exhaustive = vault_action;
            throw new Error(`get_vault_action_sigops_count: unknown vault action: ${_exhaustive}`);
        }
    }
}
