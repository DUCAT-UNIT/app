import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
import type { PriceQuote, VaultProfile, VaultWithdrawCtx, WalletVaultWithdrawConfig, WalletVaultWithdrawRequest } from '../../../../types/index.js';
export default function (client: VaultWallet): {
    ctx: (price_quote: PriceQuote, vault_profile: VaultProfile, vault_config: WalletVaultWithdrawConfig) => VaultWithdrawCtx;
    quote: typeof import("../../../vault/api/withdraw.js").get_vault_withdraw_quote;
    req: (ctx: VaultWithdrawCtx) => Promise<WalletVaultWithdrawRequest>;
};
