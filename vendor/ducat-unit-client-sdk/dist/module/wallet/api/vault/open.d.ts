import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
import type { AccountProfile, BaseUtxo, PriceQuote, VaultOpenCtx, WalletVaultOpenConfig, WalletVaultOpenRequest } from '../../../../types/index.js';
export default function (client: VaultWallet): {
    ctx: (acct_profile: AccountProfile, price_quote: PriceQuote, vault_config: WalletVaultOpenConfig) => VaultOpenCtx;
    quote: typeof import("../../../vault/api/open.js").get_vault_open_quote;
    req: (ctx: VaultOpenCtx, utxos: BaseUtxo[], batch?: boolean) => Promise<WalletVaultOpenRequest>;
};
