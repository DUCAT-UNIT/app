/**
 * Transaction Type Definitions
 */

export interface TransactionStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface TransactionInput {
  txid: string;
  vout: number;
  prevout?: {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
  };
  scriptsig: string;
  scriptsig_asm: string;
  witness?: string[];
  is_coinbase: boolean;
  sequence: number;
}

export interface TransactionOutput {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
}

export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  vin: TransactionInput[];
  vout: TransactionOutput[];
  size: number;
  weight: number;
  fee: number;
  status: TransactionStatus;
  vaultTransaction?: boolean;
  timestamp?: number;
}

export interface TransactionIntent {
  type: 'send' | 'receive' | 'vault' | 'cashu';
  address?: string;
  amount?: number;
  feeRate?: number;
  note?: string;
  runeId?: string;
  runeAmount?: bigint;
}

export interface TransactionHistory {
  transactions: Transaction[];
  lastUpdated: number;
}

// PendingTransaction: canonical definition in stores/pendingTransactionsStore.ts
