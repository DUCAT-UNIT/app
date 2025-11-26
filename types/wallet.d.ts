/**
 * Wallet Type Definitions
 */

export interface WalletAccount {
  index: number;
  name: string;
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
}

export interface Wallet {
  mnemonic: string;
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
  accounts?: WalletAccount[];
  currentAccountIndex?: number;
}

export interface WalletBalance {
  segwitBalance: number;
  taprootBalance: number;
  runesBalance: RuneBalance[];
  unconfirmedSegwitBalance: number;
  unconfirmedTaprootBalance: number;
  unconfirmedRunesBalance: Record<string, bigint>;
}

export interface RuneBalance {
  id: string;
  name: string;
  symbol: string;
  amount: bigint;
  divisibility: number;
  spacedName?: string;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: TransactionStatus;
  runeAmount?: number;
}

export interface TransactionStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}
