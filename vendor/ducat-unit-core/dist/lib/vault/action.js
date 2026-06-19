import { SYMBOLS, TXMAP } from '../../const.js';
export function get_vault_action_code(vault_action) {
    switch (vault_action) {
        case 'open':
            return SYMBOLS.CODE.VAULT.OPEN;
        case 'close':
            return SYMBOLS.CODE.VAULT.CLOSE;
        case 'borrow':
            return SYMBOLS.CODE.VAULT.BORROW;
        case 'repay':
            return SYMBOLS.CODE.VAULT.REPAY;
        case 'repo':
            return SYMBOLS.CODE.VAULT.REPO;
        case 'trim':
            return SYMBOLS.CODE.VAULT.TRIM;
        case 'withdraw':
            return SYMBOLS.CODE.VAULT.WITHDRAW;
        case 'deposit':
            return SYMBOLS.CODE.VAULT.DEPOSIT;
        default:
            throw new Error(`invalid vault action: ${vault_action}`);
    }
}
export function get_vault_action_vin_idx(vault_action) {
    switch (vault_action) {
        case 'open':
            return TXMAP.VAULT_OPEN.VIN.CONN;
        case 'close':
            return 0;
        case 'borrow':
            return TXMAP.VAULT_BORROW.VIN.VAULT;
        case 'repay':
            return TXMAP.VAULT_REPAY.VIN.VAULT;
        case 'repo':
            return TXMAP.VAULT_REPO.VIN.VAULT;
        case 'trim':
            return TXMAP.VAULT_TRIM.VIN.VAULT;
        case 'withdraw':
            return TXMAP.VAULT_WITHDRAW.VIN.VAULT;
        case 'deposit':
            return TXMAP.VAULT_DEPOSIT.VIN.VAULT;
        default:
            throw new Error(`unknown vault action: ${vault_action}`);
    }
}
export function get_vault_action_vout_idx(vault_action) {
    switch (vault_action) {
        case 'open':
            return TXMAP.VAULT_OPEN.VOUT.VAULT;
        case 'close':
            return -1;
        case 'borrow':
            return TXMAP.VAULT_BORROW.VOUT.VAULT;
        case 'repay':
            return TXMAP.VAULT_REPAY.VOUT.VAULT;
        case 'repo':
            return TXMAP.VAULT_REPO.VOUT.VAULT;
        case 'trim':
            return TXMAP.VAULT_TRIM.VOUT.VAULT;
        case 'withdraw':
            return TXMAP.VAULT_WITHDRAW.VOUT.VAULT;
        case 'deposit':
            return TXMAP.VAULT_DEPOSIT.VOUT.VAULT;
        default:
            throw new Error(`unknown vault action: ${vault_action}`);
    }
}
export function get_vault_action_label(action_code) {
    switch (action_code) {
        case SYMBOLS.CODE.VAULT.OPEN:
            return 'open';
        case SYMBOLS.CODE.VAULT.CLOSE:
            return 'close';
        case SYMBOLS.CODE.VAULT.BORROW:
            return 'borrow';
        case SYMBOLS.CODE.VAULT.REPAY:
            return 'repay';
        case SYMBOLS.CODE.VAULT.REPO:
            return 'repo';
        case SYMBOLS.CODE.VAULT.TRIM:
            return 'trim';
        case SYMBOLS.CODE.VAULT.WITHDRAW:
            return 'withdraw';
        case SYMBOLS.CODE.VAULT.DEPOSIT:
            return 'deposit';
        default:
            throw new Error(`invalid vault action code: ${action_code}`);
    }
}
