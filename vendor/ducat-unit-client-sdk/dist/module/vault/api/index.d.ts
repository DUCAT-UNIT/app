export * from './borrow.js';
export * from './open.js';
export * from './deposit.js';
export * from './repay.js';
export * from './repo.js';
export * from './withdraw.js';
declare const _default: {
    deposit: {
        create_ctx: typeof import("./deposit.js").create_vault_deposit_ctx;
        create_psbt: typeof import("./deposit.js").create_vault_deposit_psbt;
        create_req: typeof import("./deposit.js").create_vault_deposit_req;
        get_quote: typeof import("./deposit.js").get_vault_deposit_quote;
        get_change: (vault_config: import("../index.js").VaultDepositConfig, vin_utxos: import("../../../index.js").BaseUtxo[]) => number;
    };
    open: {
        create_ctx: typeof import("./open.js").create_vault_open_ctx;
        create_psbt1: typeof import("./open.js").create_vault_open_psbt1;
        create_psbt2: typeof import("./open.js").create_vault_open_psbt2;
        create_req: typeof import("./open.js").create_vault_open_req;
        get_quote: typeof import("./open.js").get_vault_open_quote;
        get_change: typeof import("./open.js").get_vault_open_change;
    };
    borrow: {
        create_ctx: typeof import("./borrow.js").create_vault_borrow_ctx;
        create_psbt1: typeof import("./borrow.js").create_vault_borrow_psbt1;
        create_psbt2: typeof import("./borrow.js").create_vault_borrow_psbt2;
        create_req: typeof import("./borrow.js").create_vault_borrow_req;
        get_quote: typeof import("./borrow.js").get_vault_borrow_quote;
        get_change: typeof import("./borrow.js").get_vault_borrow_change;
    };
    repay: {
        create_ctx: typeof import("./repay.js").create_vault_repay_ctx;
        create_psbt1: typeof import("./repay.js").create_vault_repay_psbt1;
        create_psbt2: typeof import("./repay.js").create_vault_repay_psbt2;
        create_req: typeof import("./repay.js").create_vault_repay_req;
        get_quote: typeof import("./repay.js").get_vault_repay_quote;
        get_change: typeof import("./repay.js").get_vault_repay_change;
    };
    repo: {
        create_ctx: typeof import("./repo.js").create_vault_repo_ctx;
        create_psbt1: typeof import("./repo.js").create_vault_repo_psbt1;
        create_psbt2: typeof import("./repo.js").create_vault_repo_psbt2;
        create_req: typeof import("./repo.js").create_vault_repo_req;
        get_tx_quote: typeof import("./repo.js").get_vault_repo_quote;
        get_change: typeof import("./repo.js").get_vault_repo_change;
        liquidation: {
            get_ctx: typeof import("../lib/index.js").get_liquidation_ctx;
            get_quote: typeof import("../lib/index.js").get_liquidation_quote;
            get_profile: typeof import("../lib/index.js").get_liquid_profile;
        };
    };
    withdraw: {
        create_ctx: typeof import("./withdraw.js").create_vault_withdraw_ctx;
        create_psbt: typeof import("./withdraw.js").create_vault_withdraw_psbt;
        create_req: typeof import("./withdraw.js").create_vault_withdraw_req;
        get_quote: typeof import("./withdraw.js").get_vault_withdraw_quote;
    };
};
export default _default;
