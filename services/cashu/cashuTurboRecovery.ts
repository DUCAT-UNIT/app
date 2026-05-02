/**
 * Cashu Turbo Send Recovery Service
 * Persists turbo send state to recover from app crashes/backgrounding
 *
 * Problem: If app closes after ecash is claimed but before P2PK token is sent,
 * the user has ecash but the recipient never gets their tokens.
 *
 * Solution: Persist the turbo send intent before starting. On app restart,
 * check for incomplete sends and resume them automatically.
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { DEVICE_ONLY } from '../storagePolicy';

const PENDING_TURBO_SEND_KEY = 'cashu_pending_turbo_send';

export interface PendingTurboSend {
  /** Mint quote ID for tracking */
  quoteId: string;
  /** Recipient taproot address */
  recipient: string;
  /** Amount in smallest units to send */
  amount: number;
  /** Sender's taproot address for P2PK signing */
  senderTaprootAddress: string;
  /** Timestamp when the turbo send was initiated */
  createdAt: number;
  /** Current stage of the turbo send */
  stage: 'waiting_for_mint' | 'mint_completed' | 'p2pk_created';
  /** P2PK token saved for crash recovery (set when stage = p2pk_created) */
  token?: string;
  /** Shortened URL for the token (set after URL shortening) */
  shortUrl?: string;
}

/**
 * Save a pending turbo send before starting the flow
 * This ensures we can resume if the app crashes
 */
export const savePendingTurboSend = async (
  quoteId: string,
  recipient: string,
  amount: number,
  senderTaprootAddress: string
): Promise<void> => {
  try {
    const pendingSend: PendingTurboSend = {
      quoteId,
      recipient,
      amount,
      senderTaprootAddress,
      createdAt: Date.now(),
      stage: 'waiting_for_mint',
    };

    await SecureStore.setItemAsync(PENDING_TURBO_SEND_KEY, JSON.stringify(pendingSend), DEVICE_ONLY);

    logger.info('[TurboRecovery] Saved pending turbo send', {
      quoteId: quoteId.substring(0, 8),
      recipient: recipient.substring(0, 12) + '...',
      amount,
    });
  } catch (error) {
    logger.error('[TurboRecovery] Failed to save pending turbo send', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Update the stage of a pending turbo send
 * @param stage - New stage
 * @param data - Optional additional data to persist (e.g., token for crash recovery)
 */
export const updateTurboSendStage = async (
  stage: PendingTurboSend['stage'],
  data?: { token?: string; shortUrl?: string }
): Promise<void> => {
  try {
    const pending = await loadPendingTurboSend();
    if (pending) {
      pending.stage = stage;
      if (data?.token) pending.token = data.token;
      if (data?.shortUrl) pending.shortUrl = data.shortUrl;
      await SecureStore.setItemAsync(PENDING_TURBO_SEND_KEY, JSON.stringify(pending), DEVICE_ONLY);
      logger.debug('[TurboRecovery] Updated turbo send stage', { stage, hasToken: !!data?.token });
    }
  } catch (error) {
    logger.error('[TurboRecovery] Failed to update turbo send stage', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Load the pending turbo send (if any)
 */
export const loadPendingTurboSend = async (): Promise<PendingTurboSend | null> => {
  try {
    const stored = await SecureStore.getItemAsync(PENDING_TURBO_SEND_KEY);
    if (!stored) {
      return null;
    }

    const pending: PendingTurboSend = JSON.parse(stored);

    // Expire after 24 hours
    const EXPIRY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - pending.createdAt > EXPIRY_MS) {
      logger.info('[TurboRecovery] Pending turbo send expired, removing');
      await clearPendingTurboSend();
      return null;
    }

    return pending;
  } catch (error) {
    logger.error('[TurboRecovery] Failed to load pending turbo send', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Clear the pending turbo send (after successful completion)
 */
export const clearPendingTurboSend = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(PENDING_TURBO_SEND_KEY);
    logger.info('[TurboRecovery] Cleared pending turbo send');
  } catch (error) {
    logger.error('[TurboRecovery] Failed to clear pending turbo send', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Check if there's a pending turbo send that needs recovery
 */
export const hasPendingTurboSend = async (): Promise<boolean> => {
  const pending = await loadPendingTurboSend();
  return pending !== null;
};

/**
 * Recover a pending turbo send
 * Called on app startup to resume incomplete turbo sends
 *
 * @param sendP2PKToken - Function to send P2PK token
 * @param extractPubkey - Function to extract pubkey from taproot address
 * @param shortenToken - Function to shorten cashu token
 * @param saveToken - Function to save sent locked token
 * @returns Recovery result with token and deeplink if successful
 */
export interface TurboRecoveryResult {
  recovered: boolean;
  token?: string;
  deeplink?: string;
  recipient?: string;
  amount?: number;
  error?: string;
}

export const recoverPendingTurboSend = async (
  sendP2PKToken: (amount: number, pubkey: string, options: Record<string, unknown>) => Promise<{ token: string } | null>,
  extractPubkey: (address: string) => string | null,
  shortenToken: (token: string) => Promise<string>,
  saveToken: (token: string, recipient: string, amount: number, txid: string | null, shortUrl: string, senderAddress: string | undefined) => Promise<void>
): Promise<TurboRecoveryResult> => {
  try {
    const pending = await loadPendingTurboSend();

    if (!pending) {
      return { recovered: false };
    }

    logger.info('[TurboRecovery] Found pending turbo send, attempting recovery', {
      quoteId: pending.quoteId.substring(0, 8),
      stage: pending.stage,
      recipient: pending.recipient.substring(0, 12) + '...',
      amount: pending.amount,
    });

    // If we're still waiting for mint, the mint quote recovery will handle it
    // We only need to resume if mint completed but P2PK wasn't sent
    if (pending.stage === 'waiting_for_mint') {
      logger.debug('[TurboRecovery] Still waiting for mint, mint quote recovery will handle this');
      return { recovered: false };
    }

    // Mint completed but P2PK not created/sent - resume from here
    if (pending.stage === 'mint_completed') {
      logger.info('[TurboRecovery] Mint was completed, resuming P2PK token creation');

      const recipientPubkey = extractPubkey(pending.recipient);
      if (!recipientPubkey) {
        throw new Error('Failed to extract pubkey from recipient address');
      }

      // Create P2PK token
      const result = await sendP2PKToken(pending.amount, recipientPubkey, {});
      if (!result?.token) {
        throw new Error('sendP2PKToken returned no token');
      }

      logger.info('[TurboRecovery] P2PK token created successfully');

      // Persist the token before any URL/history work so another crash can retry safely.
      await updateTurboSendStage('p2pk_created', { token: result.token });

      // Generate shortened URL
      const shortUrl = await shortenToken(result.token);
      await updateTurboSendStage('p2pk_created', { token: result.token, shortUrl });
      logger.info('[TurboRecovery] Generated short URL', { shortUrlLength: shortUrl.length });

      // Save the token
      await saveToken(result.token, pending.recipient, pending.amount, null, shortUrl, pending.senderTaprootAddress);
      logger.info('[TurboRecovery] Token saved successfully');

      // Clear the pending send
      await clearPendingTurboSend();

      return {
        recovered: true,
        token: result.token,
        deeplink: shortUrl,
        recipient: pending.recipient,
        amount: pending.amount,
      };
    }

    // P2PK was created but maybe not saved to locked tokens — re-save using persisted token
    if (pending.stage === 'p2pk_created') {
      logger.info('[TurboRecovery] P2PK was created, attempting to re-save token');

      if (!pending.token) {
        throw new Error('P2PK token missing from recovery data');
      }

      // Re-generate short URL if not saved
      const shortUrl = pending.shortUrl || await shortenToken(pending.token);
      await updateTurboSendStage('p2pk_created', { token: pending.token, shortUrl });
      // Re-save the locked token
      await saveToken(pending.token, pending.recipient, pending.amount, null, shortUrl, pending.senderTaprootAddress);
      logger.info('[TurboRecovery] Re-saved token from recovery data');

      await clearPendingTurboSend();
      return {
        recovered: true,
        token: pending.token,
        deeplink: shortUrl,
        recipient: pending.recipient,
        amount: pending.amount,
      };
    }

    return { recovered: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[TurboRecovery] Recovery failed', { error: errorMsg });
    return { recovered: false, error: errorMsg };
  }
};
