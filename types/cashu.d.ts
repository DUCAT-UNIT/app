/**
 * Cashu Type Definitions
 */

/**
 * Proof structure for Cashu tokens
 * Also aliased as Proof for backwards compatibility
 */
export interface CashuProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}

/**
 * Alias for CashuProof - used in various hooks
 */
export type Proof = CashuProof;

/**
 * Proof state string literal values
 */
export type ProofStateValue = 'UNSPENT' | 'SPENT' | 'PENDING';

/**
 * Proof state response from mint API
 */
export interface ProofState {
  Y: string;
  state: string;
  witness?: string;
}

/**
 * Proof with state information
 */
export interface ProofWithState extends CashuProof {
  state: ProofStateValue;
}

/**
 * Decoded token structure
 */
export interface DecodedToken {
  proofs: CashuProof[];
  amount: number;
  mint: string;
}

/**
 * Ecash token for transaction history
 */
export interface EcashToken {
  amount: number;
  mint: string;
  token: string;
  timestamp?: number;
  proofs?: CashuProof[];
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
