import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
import type { BaseUtxo, LiquidationCtx, PriceQuote, VaultProfile, VaultRepoCtx, WalletVaultRepoConfig, WalletVaultRepoRequest } from '../../../../types/index.js';
export default function (client: VaultWallet): {
    ctx: (price_quote: PriceQuote, vault_profile: VaultProfile, vault_config: WalletVaultRepoConfig) => VaultRepoCtx;
    liquidation: {
        get_ctx: typeof import("../../../vault/lib/index.js").get_liquidation_ctx;
        get_quote: typeof import("../../../vault/lib/index.js").get_liquidation_quote;
        get_profile: typeof import("../../../vault/lib/index.js").get_liquid_profile;
    };
    quote: typeof import("../../../vault/api/repo.js").get_vault_repo_quote;
    req: (liquid_ctx: LiquidationCtx, vault_ctx: VaultRepoCtx, utxos: BaseUtxo[], batch?: boolean) => Promise<WalletVaultRepoRequest>;
};
