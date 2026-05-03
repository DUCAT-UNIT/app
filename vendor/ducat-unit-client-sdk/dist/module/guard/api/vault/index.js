import vault_borrow_api from './borrow.js';
import vault_deposit_api from './deposit.js';
import vault_open_api from './open.js';
import vault_repay_api from './repay.js';
import vault_repo_api from './repo.js';
import vault_withdraw_api from './withdraw.js';
export default function (client) {
    return {
        borrow: vault_borrow_api(client),
        deposit: vault_deposit_api(client),
        open: vault_open_api(client),
        repay: vault_repay_api(client),
        repo: vault_repo_api(client),
        withdraw: vault_withdraw_api(client),
    };
}
