import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
declare const _default: (client: VaultWallet) => {
    open: {
        ctx: (acct_profile: import("../../../oracle/index.js").AccountProfile, price_quote: import("../../../oracle/index.js").PriceQuote, vault_config: import("../../index.js").WalletVaultOpenConfig) => import("../../../vault/index.js").VaultOpenCtx;
        quote: typeof import("../../../vault/api/open.js").get_vault_open_quote;
        req: (ctx: import("../../../vault/index.js").VaultOpenCtx, utxos: import("../../../../index.js").BaseUtxo[], batch?: boolean) => Promise<import("../../index.js").WalletVaultOpenRequest>;
    };
    borrow: {
        ctx: (acct_profile: import("../../../oracle/index.js").AccountProfile, price_quote: import("../../../oracle/index.js").PriceQuote, vault_profile: import("../../../oracle/index.js").VaultProfile, vault_config: import("../../index.js").WalletVaultBorrowConfig) => import("../../../vault/index.js").VaultBorrowCtx;
        quote: typeof import("../../../vault/api/borrow.js").get_vault_borrow_quote;
        req: (ctx: import("../../../vault/index.js").VaultBorrowCtx, utxos: import("../../../../index.js").BaseUtxo[], batch?: boolean) => Promise<import("../../index.js").WalletVaultBorrowRequest>;
    };
    repay: {
        ctx: (acct_profile: import("../../../oracle/index.js").AccountProfile, price_quote: import("../../../oracle/index.js").PriceQuote, vault_profile: import("../../../oracle/index.js").VaultProfile, vault_config: import("../../index.js").WalletVaultRepayConfig) => import("../../../vault/index.js").VaultRepayCtx;
        quote: typeof import("../../../vault/api/repay.js").get_vault_repay_quote;
        req: (ctx: import("../../../vault/index.js").VaultRepayCtx, sats_utxos: import("../../../../index.js").BaseUtxo[], unit_utxos: import("../../../../index.js").RuneUtxo[], batch?: boolean) => Promise<import("../../index.js").WalletVaultRepayRequest>;
    };
    repo: {
        ctx: (price_quote: import("../../../oracle/index.js").PriceQuote, vault_profile: import("../../../oracle/index.js").VaultProfile, vault_config: import("../../index.js").WalletVaultRepoConfig) => import("../../../vault/index.js").VaultRepoCtx;
        liquidation: {
            get_ctx: typeof import("../../../vault/lib/index.js").get_liquidation_ctx;
            get_quote: typeof import("../../../vault/lib/index.js").get_liquidation_quote;
            get_profile: typeof import("../../../vault/lib/index.js").get_liquid_profile;
        };
        quote: typeof import("../../../vault/api/repo.js").get_vault_repo_quote;
        req: (liquid_ctx: import("../../../vault/index.js").LiquidationCtx, vault_ctx: import("../../../vault/index.js").VaultRepoCtx, utxos: import("../../../../index.js").BaseUtxo[], batch?: boolean) => Promise<import("../../index.js").WalletVaultRepoRequest>;
    };
    deposit: {
        ctx: (price_quote: import("../../../oracle/index.js").PriceQuote, vault_profile: import("../../../oracle/index.js").VaultProfile, vault_config: import("../../index.js").WalletVaultDepositConfig) => import("../../../vault/index.js").VaultDepositCtx;
        quote: typeof import("../../../vault/api/deposit.js").get_vault_deposit_quote;
        req: (ctx: import("../../../vault/index.js").VaultDepositCtx, utxos: import("../../../../index.js").BaseUtxo[]) => Promise<import("../../index.js").WalletVaultDepositRequest>;
    };
    withdraw: {
        ctx: (price_quote: import("../../../oracle/index.js").PriceQuote, vault_profile: import("../../../oracle/index.js").VaultProfile, vault_config: import("../../index.js").WalletVaultWithdrawConfig) => import("../../../vault/index.js").VaultWithdrawCtx;
        quote: typeof import("../../../vault/api/withdraw.js").get_vault_withdraw_quote;
        req: (ctx: import("../../../vault/index.js").VaultWithdrawCtx) => Promise<import("../../index.js").WalletVaultWithdrawRequest>;
    };
};
export default _default;
