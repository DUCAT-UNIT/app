import { VaultWallet } from '../../../../module/wallet/class/wallet.js';
import type { AccountProfile, BaseUtxo, PriceQuote, RuneUtxo, VaultProfile, VaultRepayCtx, WalletVaultRepayConfig, WalletVaultRepayRequest } from '../../../../types/index.js';
export default function (client: VaultWallet): {
    ctx: (acct_profile: AccountProfile, price_quote: PriceQuote, vault_profile: VaultProfile, vault_config: WalletVaultRepayConfig) => VaultRepayCtx;
    quote: typeof import("../../../vault/api/repay.js").get_vault_repay_quote;
    req: (ctx: VaultRepayCtx, sats_utxos: BaseUtxo[], unit_utxos: RuneUtxo[], batch?: boolean) => Promise<WalletVaultRepayRequest>;
};
