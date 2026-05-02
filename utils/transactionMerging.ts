/**
 * Transaction Merging Utilities
 * Shared logic for processing pending transactions, ecash tokens,
 * and merging/sorting all transaction types.
 *
 * Used by:
 * - hooks/useAssetTransactions.ts
 * - hooks/useTransactionHistoryData.ts
 */

import { TokenWithStatus } from '../services/cashu/tokenStatusService';

/**
 * Minimal transaction data computed from calculateTransactionAmount
 */
export interface TxData {
  amount: number | bigint;
  assetType: string;
  numericAmount: number;
  isSent: boolean;
  isReceived: boolean;
  isSelfTransfer?: boolean;
  isAutoclaim?: boolean;
}

/**
 * A pending transaction from the PendingTransactionsContext store
 */
export interface PendingTx {
  txid: string;
  status: string;
  assetType: string;
  timestamp: number;
  sentAmount?: number;
  outputs: Array<{ value?: number; runeAmount?: number }>;
}

/**
 * Minimal processed transaction shape for merging
 */
export interface MergeableTransaction {
  txid: string;
  timestamp?: number;
  status?: {
    confirmed: boolean;
    block_time: number;
    block_height?: number;
    block_hash?: string;
    failed?: boolean;
  };
  txData?: TxData;
  ecashToken?: boolean;
  tokenData?: TokenWithStatus;
  claimed?: boolean;
  partiallySpent?: boolean;
  isAutoclaim?: boolean;
  isPending?: boolean;
  vaultTransaction?: boolean;
}

/**
 * Convert pending transactions to a mergeable format
 * Filters by asset type and excludes already-confirmed transactions
 */
export function processPendingTransactions(
  pendingTransactions: Record<string, PendingTx>,
  assetType: string | undefined,
  confirmedTxids: Set<string>
): MergeableTransaction[] {
  return Object.values(pendingTransactions)
    .filter(tx => {
      if (tx.status !== 'pending') return false;
      if (assetType !== undefined && tx.assetType !== assetType) return false;
      return !confirmedTxids.has(tx.txid);
    })
    .map(tx => {
      let amount: number;
      if (tx.sentAmount !== undefined && tx.sentAmount > 0) {
        amount = -tx.sentAmount;
      } else {
        const totalValue = tx.outputs.reduce((sum, output) => sum + (output.value || 0), 0);
        const totalRuneAmount = tx.outputs.reduce((sum, output) => sum + (output.runeAmount || 0), 0);
        amount = tx.assetType === 'UNIT' ? -totalRuneAmount : -totalValue;
      }

      return {
        txid: tx.txid,
        timestamp: tx.timestamp / 1000,
        status: {
          confirmed: false,
          block_time: Math.floor(tx.timestamp / 1000),
        },
        isPending: true,
        txData: {
          amount,
          assetType: tx.assetType,
          numericAmount: amount,
          isSent: true,
          isReceived: false,
        },
      } as MergeableTransaction;
    });
}

/**
 * Identify self-claimed sent token IDs
 * A self-claim is when the recipient of a sent token is the current user
 */
export function findSelfClaimedTokenIds(
  ecashTokens: TokenWithStatus[],
  currentPubkeyHex: string | null
): Set<string> {
  const selfClaimedSentTokenIds = new Set<string>();
  ecashTokens.forEach((token) => {
    const isSentToken = 'recipient' in token;
    if (isSentToken && token.claimed) {
      const sentToken = token as { recipient: string; taprootAddress: string | null };
      const isSelfClaim = currentPubkeyHex && sentToken.recipient === currentPubkeyHex;
      if (isSelfClaim) {
        selfClaimedSentTokenIds.add(token.id);
      }
    }
  });
  return selfClaimedSentTokenIds;
}

/**
 * Process ecash tokens into mergeable transactions
 * Filters out self-claim duplicates and marks autoclaims
 */
export function processEcashTokens(
  ecashTokens: TokenWithStatus[],
  selfClaimedSentTokenIds: Set<string>,
  taprootAddress: string | undefined
): MergeableTransaction[] {
  return ecashTokens
    .filter((token) => {
      const isReceivedToken = 'sender' in token;
      if (isReceivedToken) {
        const receivedToken = token as { sender: string; taprootAddress: string | null };
        if (receivedToken.taprootAddress && taprootAddress && receivedToken.taprootAddress === taprootAddress) {
          return false;
        }
      }
      return true;
    })
    .map((token) => {
      // Token amounts may be in display units (legacy, e.g. 5.00) or cents (new, e.g. 500).
      // Normalize to cents so formatUnitAmount() (which divides by 100) displays correctly.
      // Heuristic: if amount has a fractional part, it's display units; otherwise cents.
      const raw = token.amount;
      const amountInCents = raw !== Math.floor(raw) ? Math.round(raw * 100) : raw;
      const isSentToken = 'recipient' in token;
      const isAutoclaim = selfClaimedSentTokenIds.has(token.id);

      return {
        txid: token.id,
        timestamp: token.timestamp,
        ecashToken: true,
        tokenData: token,
        claimed: token.claimed,
        partiallySpent: token.partiallySpent,
        isAutoclaim,
        txData: {
          amount: isAutoclaim ? amountInCents : (isSentToken ? -amountInCents : amountInCents),
          assetType: 'UNIT',
          numericAmount: isAutoclaim ? amountInCents : (isSentToken ? -amountInCents : amountInCents),
          isSent: isSentToken && !isAutoclaim,
          isReceived: !isSentToken || isAutoclaim,
          isAutoclaim,
        },
      } as MergeableTransaction;
    });
}

/**
 * Normalize timestamps to seconds for comparison
 * - ecash tokens use milliseconds (Date.now())
 * - on-chain transactions use seconds (block_time)
 * - pending transactions use timestamp / 1000 (already converted)
 */
export function getTimeInSeconds(tx: MergeableTransaction): number {
  if (tx.ecashToken && tx.timestamp) {
    return tx.timestamp / 1000;
  }
  return tx.timestamp || tx.status?.block_time || 0;
}

/**
 * Merge and sort transactions: pending first, then by timestamp (most recent first)
 */
export function mergeAndSortTransactions(
  ...txArrays: MergeableTransaction[][]
): MergeableTransaction[] {
  const all = txArrays.flat();
  return all.sort((a, b) => {
    const aIsPending = a.isPending;
    const bIsPending = b.isPending;

    if (aIsPending === bIsPending) {
      const aTime = getTimeInSeconds(a);
      const bTime = getTimeInSeconds(b);
      return bTime - aTime;
    }

    return aIsPending ? -1 : 1;
  });
}
