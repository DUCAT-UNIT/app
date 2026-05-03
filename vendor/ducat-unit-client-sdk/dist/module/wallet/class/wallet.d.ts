import { ProtocolProfile } from '../../../types/index.js';
import type { SignPSBTEntry, WalletAccountRecord, WalletConfig, WalletConnectAPI } from '../types/connect.js';
export declare class VaultWallet {
    private readonly _acct;
    private readonly _conf;
    private readonly _conn;
    private readonly _mctx;
    constructor(accounts: WalletAccountRecord, proto_ctx: ProtocolProfile, connector: WalletConnectAPI, config: WalletConfig);
    get acct(): WalletAccountRecord;
    get config(): WalletConfig;
    get contract_id(): string;
    get network(): import("../../../types/index.js").ChainNetwork;
    get conn(): WalletConnectAPI;
    get ctx(): ProtocolProfile;
    get fetch(): {
        balance: () => Promise<import("../../../types/index.js").RuneAddressBalance>;
        sats_utxos: (amount?: number) => Promise<import("../../../types/index.js").BaseUtxo[]>;
        rune_utxos: (rune: string, amount?: number) => Promise<import("../../../types/index.js").RuneUtxo[]>;
        vault_tokens: () => Promise<Map<string, import("../../../types/index.js").VaultToken>>;
    };
    get sign(): {
        batch: (psbts: SignPSBTEntry[]) => Promise<string[]>;
        psbt: (psbt: string, vins: Record<string, number[]>) => Promise<string>;
        utxos: (psbt: string) => Promise<string>;
    };
    get vault(): {
        open: {
            ctx: (acct_profile: import("../../../types/index.js").AccountProfile, price_quote: import("../../../types/index.js").PriceQuote, vault_config: import("../../../types/index.js").WalletVaultOpenConfig) => import("../../../types/index.js").VaultOpenCtx;
            quote: typeof import("../../vault/api/open.js").get_vault_open_quote;
            req: (ctx: import("../../../types/index.js").VaultOpenCtx, utxos: import("../../../types/index.js").BaseUtxo[], batch?: boolean) => Promise<import("../../../types/index.js").WalletVaultOpenRequest>;
        };
        borrow: {
            ctx: (acct_profile: import("../../../types/index.js").AccountProfile, price_quote: import("../../../types/index.js").PriceQuote, vault_profile: import("../../../types/index.js").VaultProfile, vault_config: import("../../../types/index.js").WalletVaultBorrowConfig) => import("../../../types/index.js").VaultBorrowCtx;
            quote: typeof import("../../vault/api/borrow.js").get_vault_borrow_quote;
            req: (ctx: import("../../../types/index.js").VaultBorrowCtx, utxos: import("../../../types/index.js").BaseUtxo[], batch?: boolean) => Promise<import("../../../types/index.js").WalletVaultBorrowRequest>;
        };
        repay: {
            ctx: (acct_profile: import("../../../types/index.js").AccountProfile, price_quote: import("../../../types/index.js").PriceQuote, vault_profile: import("../../../types/index.js").VaultProfile, vault_config: import("../../../types/index.js").WalletVaultRepayConfig) => import("../../../types/index.js").VaultRepayCtx;
            quote: typeof import("../../vault/api/repay.js").get_vault_repay_quote;
            req: (ctx: import("../../../types/index.js").VaultRepayCtx, sats_utxos: import("../../../types/index.js").BaseUtxo[], unit_utxos: import("../../../types/index.js").RuneUtxo[], batch?: boolean) => Promise<import("../../../types/index.js").WalletVaultRepayRequest>;
        };
        repo: {
            ctx: (price_quote: import("../../../types/index.js").PriceQuote, vault_profile: import("../../../types/index.js").VaultProfile, vault_config: import("../../../types/index.js").WalletVaultRepoConfig) => import("../../../types/index.js").VaultRepoCtx;
            liquidation: {
                get_ctx: typeof import("../../vault/lib/index.js").get_liquidation_ctx;
                get_quote: typeof import("../../vault/lib/index.js").get_liquidation_quote;
                get_profile: typeof import("../../vault/lib/index.js").get_liquid_profile;
            };
            quote: typeof import("../../vault/api/repo.js").get_vault_repo_quote;
            req: (liquid_ctx: import("../../../types/index.js").LiquidationCtx, vault_ctx: import("../../../types/index.js").VaultRepoCtx, utxos: import("../../../types/index.js").BaseUtxo[], batch?: boolean) => Promise<import("../../../types/index.js").WalletVaultRepoRequest>;
        };
        deposit: {
            ctx: (price_quote: import("../../../types/index.js").PriceQuote, vault_profile: import("../../../types/index.js").VaultProfile, vault_config: import("../../../types/index.js").WalletVaultDepositConfig) => import("../../../types/index.js").VaultDepositCtx;
            quote: typeof import("../../vault/api/deposit.js").get_vault_deposit_quote;
            req: (ctx: import("../../../types/index.js").VaultDepositCtx, utxos: import("../../../types/index.js").BaseUtxo[]) => Promise<import("../../../types/index.js").WalletVaultDepositRequest>;
        };
        withdraw: {
            ctx: (price_quote: import("../../../types/index.js").PriceQuote, vault_profile: import("../../../types/index.js").VaultProfile, vault_config: import("../../../types/index.js").WalletVaultWithdrawConfig) => import("../../../types/index.js").VaultWithdrawCtx;
            quote: typeof import("../../vault/api/withdraw.js").get_vault_withdraw_quote;
            req: (ctx: import("../../../types/index.js").VaultWithdrawCtx) => Promise<import("../../../types/index.js").WalletVaultWithdrawRequest>;
        };
    };
}
