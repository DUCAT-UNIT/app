/**
 * Cashu Type Definitions
 *
 * Cashu is an e-cash protocol for Bitcoin. These types define the core
 * data structures used in Cashu token operations, including proofs,
 * mint interactions, and token encoding/decoding.
 *
 * @see https://github.com/cashubtc/nuts for the Cashu specification
 */

/**
 * Proof structure for Cashu tokens (NUT-00 compliant)
 *
 * A proof is the fundamental unit of value in Cashu. It represents
 * a blinded signature from a mint that can be redeemed for satoshis.
 *
 * @property amount - The amount in satoshis this proof represents
 * @property secret - A unique secret that identifies this proof (prevents double-spending)
 * @property C - The blinded signature from the mint (curve point)
 * @property id - The keyset ID identifying which mint keys signed this proof
 *
 * @example
 * const proof: CashuProof = {
 *   amount: 1000,
 *   secret: 'abc123...',
 *   C: '02abc...',
 *   id: '00d31c9e'
 * };
 */
export interface CashuProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}

/**
 * Alias for CashuProof - used in various hooks for backwards compatibility
 * @deprecated Prefer CashuProof for new code
 */
export type Proof = CashuProof;

/**
 * Proof state string literal values (NUT-07)
 *
 * Represents the spending state of a proof as tracked by the mint:
 * - UNSPENT: Proof is valid and can be spent
 * - SPENT: Proof has been redeemed and is no longer valid
 * - PENDING: Proof is in a pending state (e.g., during melt)
 *
 * @example
 * function isSpendable(state: ProofStateValue): boolean {
 *   return state === 'UNSPENT';
 * }
 */
export type ProofStateValue = 'UNSPENT' | 'SPENT' | 'PENDING';

/**
 * Proof state response from mint's /v1/checkstate endpoint (NUT-07)
 *
 * @property Y - The Y point of the proof (derived from secret)
 * @property state - The state string from the mint
 * @property witness - Optional witness data for P2PK proofs
 */
export interface ProofState {
  Y: string;
  state: string;
  witness?: string;
}

/**
 * Proof with state information attached
 * Extends CashuProof with the current spending state
 *
 * @example
 * const proofWithState: ProofWithState = {
 *   amount: 1000,
 *   secret: 'abc123...',
 *   C: '02abc...',
 *   id: '00d31c9e',
 *   state: 'UNSPENT'
 * };
 */
export interface ProofWithState extends CashuProof {
  state: ProofStateValue;
}

/**
 * Decoded token structure
 *
 * Represents a Cashu token after decoding from its serialized form.
 * Contains all proofs and metadata needed to redeem the token.
 *
 * @property proofs - Array of CashuProof objects
 * @property amount - Total amount in satoshis (sum of all proof amounts)
 * @property mint - The mint URL these proofs are redeemable at
 *
 * @example
 * const decoded: DecodedToken = decodeToken('cashuAey...');
 * console.log(`Token worth ${decoded.amount} sats from ${decoded.mint}`);
 */
export interface DecodedToken {
  proofs: CashuProof[];
  amount: number;
  mint: string;
}

/**
 * Ecash token for transaction history display
 *
 * Used to track sent/received tokens in the wallet's transaction list.
 *
 * @property amount - The token amount in satoshis
 * @property mint - The mint URL
 * @property token - The serialized token string (cashuA...)
 * @property timestamp - Unix timestamp when the token was created/received
 * @property proofs - Optional array of proofs for detailed view
 */
export interface EcashToken {
  amount: number;
  mint: string;
  token: string;
  timestamp?: number;
  proofs?: CashuProof[];
}

/**
 * Full Cashu token structure (NUT-00 V3 format)
 *
 * The complete token format that can contain proofs from multiple mints.
 *
 * @property token - Array of mint-proof pairs
 * @property memo - Optional human-readable memo
 * @property unit - The unit of account (e.g., 'sat' for satoshis)
 *
 * @example
 * const token: CashuToken = {
 *   token: [{
 *     mint: 'https://mint.example.com',
 *     proofs: [{ amount: 1000, secret: '...', C: '...', id: '...' }]
 *   }],
 *   memo: 'Payment for coffee',
 *   unit: 'sat'
 * };
 */
export interface CashuToken {
  token: Array<{
    mint: string;
    proofs: CashuProof[];
  }>;
  memo?: string;
  unit?: string;
}

/**
 * Cashu mint information (NUT-06)
 *
 * Metadata about a Cashu mint obtained from its /info endpoint.
 *
 * @property url - The mint's base URL
 * @property name - Optional display name
 * @property description - Optional description
 * @property publicKey - The mint's public key for verification
 */
export interface CashuMint {
  url: string;
  name?: string;
  description?: string;
  publicKey?: string;
}

/**
 * Pending mint quote tracking
 *
 * Tracks a mint quote while waiting for Lightning payment to be received.
 *
 * @property quote - The unique quote ID from the mint
 * @property amount - Amount in satoshis being minted
 * @property hash - Payment hash for tracking
 * @property timestamp - When the quote was created
 * @property expiresAt - When the quote expires (Unix timestamp)
 *
 * @example
 * const pending: PendingMint = {
 *   quote: 'abc123',
 *   amount: 10000,
 *   hash: 'lnbc...',
 *   timestamp: Date.now(),
 *   expiresAt: Date.now() + 3600000 // 1 hour
 * };
 */
export interface PendingMint {
  quote: string;
  amount: number;
  hash: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * Mint quote response (NUT-04)
 *
 * Response from /v1/mint/quote/bolt11 endpoint when requesting to mint tokens.
 *
 * @property quote - Unique quote identifier
 * @property request - Lightning invoice to pay
 * @property paid - Whether the invoice has been paid
 * @property expiry - Quote expiration (Unix timestamp)
 *
 * @example
 * const quote: MintQuoteResponse = await mint.getMintQuote(1000);
 * // Display quote.request as QR code for user to pay
 * // Poll quote.paid until true, then mint tokens
 */
export interface MintQuoteResponse {
  quote: string;
  request: string;
  paid: boolean;
  expiry: number;
}

/**
 * Melt quote response (NUT-05)
 *
 * Response from /v1/melt/quote/bolt11 endpoint when melting tokens to pay a Lightning invoice.
 *
 * @property quote - Unique quote identifier
 * @property amount - Amount to be melted (excluding fees)
 * @property fee_reserve - Reserved amount for Lightning routing fees
 * @property paid - Whether the melt has been completed
 * @property expiry - Quote expiration (Unix timestamp)
 *
 * @example
 * const meltQuote: MeltQuoteResponse = await mint.getMeltQuote(invoice);
 * const totalCost = meltQuote.amount + meltQuote.fee_reserve;
 */
export interface MeltQuoteResponse {
  quote: string;
  amount: number;
  fee_reserve: number;
  paid: boolean;
  expiry: number;
}

/**
 * Aggregated Cashu balance information
 *
 * Summary of all Cashu proofs held by the wallet.
 *
 * @property totalBalance - Total balance across all mints in satoshis
 * @property balanceByMint - Balance breakdown by mint URL
 * @property proofCount - Total number of proofs held
 *
 * @example
 * const balance: CashuBalance = {
 *   totalBalance: 50000,
 *   balanceByMint: {
 *     'https://mint1.example.com': 30000,
 *     'https://mint2.example.com': 20000
 *   },
 *   proofCount: 15
 * };
 */
export interface CashuBalance {
  totalBalance: number;
  balanceByMint: Record<string, number>;
  proofCount: number;
}

/**
 * Cashu wallet state for React context
 *
 * Represents the current state of the Cashu wallet in the app.
 *
 * @property balance - Current total balance in satoshis
 * @property isLoading - Whether a wallet operation is in progress
 * @property error - Current error message, if any
 * @property pendingMints - Array of pending mint operations
 *
 * @example
 * // In a component
 * const { balance, isLoading, error } = useCashu();
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * return <Balance amount={balance} />;
 */
export interface CashuWalletState {
  balance: number;
  isLoading: boolean;
  error: string | null;
  pendingMints: PendingMint[];
}
