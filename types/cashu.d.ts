/**
 * Cashu Type Definitions
 */

export interface CashuProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}

export interface CashuToken {
  token: Array<{
    mint: string;
    proofs: CashuProof[];
  }>;
  memo?: string;
  unit?: string;
}

export interface CashuMint {
  url: string;
  name?: string;
  description?: string;
  publicKey?: string;
}

export interface PendingMint {
  quote: string;
  amount: number;
  hash: string;
  timestamp: number;
  expiresAt: number;
}

export interface MintQuoteResponse {
  quote: string;
  request: string;
  paid: boolean;
  expiry: number;
}

export interface MeltQuoteResponse {
  quote: string;
  amount: number;
  fee_reserve: number;
  paid: boolean;
  expiry: number;
}

export interface CashuBalance {
  totalBalance: number;
  balanceByMint: Record<string, number>;
  proofCount: number;
}

export interface CashuWalletState {
  balance: number;
  isLoading: boolean;
  error: string | null;
  pendingMints: PendingMint[];
}
