import { VaultToken } from '../../../types/index.js';
import { VaultWallet } from '../class/wallet.js';
declare const _default: (client: VaultWallet) => {
    balance: () => Promise<import("../../../types/index.js").RuneAddressBalance>;
    sats_utxos: (amount?: number) => Promise<import("../../../types/index.js").BaseUtxo[]>;
    rune_utxos: (rune: string, amount?: number) => Promise<import("../../../types/index.js").RuneUtxo[]>;
    vault_tokens: () => Promise<Map<string, VaultToken>>;
};
export default _default;
