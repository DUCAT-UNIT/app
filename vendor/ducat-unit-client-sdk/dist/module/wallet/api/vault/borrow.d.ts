import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
import type { AccountProfile, BaseUtxo, PriceQuote, VaultBorrowCtx, VaultProfile, WalletVaultBorrowConfig, WalletVaultBorrowRequest } from '../../../../types/index.js';
export default function (client: VaultWallet): {
    ctx: (acct_profile: AccountProfile, price_quote: PriceQuote, vault_profile: VaultProfile, vault_config: WalletVaultBorrowConfig) => VaultBorrowCtx;
    quote: typeof import("../../../vault/api/borrow.js").get_vault_borrow_quote;
    req: (ctx: VaultBorrowCtx, utxos: BaseUtxo[], batch?: boolean) => Promise<WalletVaultBorrowRequest>;
};
