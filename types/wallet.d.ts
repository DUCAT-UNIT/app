/**
 * Wallet Type Definitions
 *
 * Note: Most wallet types are defined at their source:
 *   - RuneBalance, WalletBalances → services/balanceService.ts
 *   - UTXO, TransactionStatus → services/balanceService.ts
 *   - WalletAddresses (canonical) → contexts/WalletContext.tsx
 *
 * This file exists only for types/crypto.d.ts ambient reference.
 */

export interface WalletAddresses {
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
}
