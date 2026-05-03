import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
import type { BaseUtxo, PriceQuote, VaultDepositCtx, VaultProfile, WalletVaultDepositConfig, WalletVaultDepositRequest } from '../../../../types/index.js';
export default function (client: VaultWallet): {
    ctx: (price_quote: PriceQuote, vault_profile: VaultProfile, vault_config: WalletVaultDepositConfig) => VaultDepositCtx;
    quote: typeof import("../../../vault/api/deposit.js").get_vault_deposit_quote;
    req: (ctx: VaultDepositCtx, utxos: BaseUtxo[]) => Promise<WalletVaultDepositRequest>;
};
