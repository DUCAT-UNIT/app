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
import { checkMintStatus, completeMint } from './operations/cashuMintOperations';
import { clearRecoveredOutgoingSwapToken } from './cashuSwapRecovery';
import { getBalance } from './cashuBalanceService';
import { getCurrentCashuAccount } from './cashuProofManager';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from './cashuUnits';

const PENDING_TURBO_SEND_KEY = 'cashu_pending_turbo_send';
const PENDING_TURBO_SEND_REGISTRY_KEY = 'cashu_pending_turbo_sends_v1';

export interface PendingTurboSend {
  /** Mint quote ID for tracking */
  quoteId: string;
  /** Recipient taproot address */
  recipient: string;
  /** Amount in smallest units to send */
  amount: number;
  /** Amount in smallest units to claim from the mint quote when topping up */
  mintAmount?: number;
  /** Spendable Turbo balance before funding the mint quote */
  preMintBalance?: number;
  /** Sender's taproot address for P2PK signing */
  senderTaprootAddress: string;
  /** Cashu unit for the proofs/token */
  unit?: CashuUnit;
  /** Timestamp when the turbo send was initiated */
  createdAt: number;
  /** Current stage of the turbo send */
  stage: 'waiting_for_mint' | 'mint_completed' | 'p2pk_created';
  /** P2PK token saved for crash recovery (set when stage = p2pk_created) */
  token?: string;
  /** Shortened URL for the token (set after URL shortening) */
  shortUrl?: string;
}

interface PendingTurboSendEntry {
  pending: PendingTurboSend;
  storageKey: string;
  legacy: boolean;
}

export interface PendingTurboSendSelector {
  quoteId?: string;
  senderTaprootAddress?: string | null;
  unit?: CashuUnit;
  recipient?: string | null;
  amount?: number;
}

const safeStorageSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_');

const normalizeStoredTurboUnit = (unit: unknown): CashuUnit | undefined => {
  if (unit === undefined || unit === null) {
    return undefined;
  }
  if (typeof unit !== 'string') {
    throw new Error('Invalid pending turbo send unit');
  }
  const normalized = normalizeCashuUnit(unit);
  return normalized === DEFAULT_CASHU_UNIT ? undefined : normalized;
};

const parsePendingTurboSend = (stored: string): PendingTurboSend => {
  const pending = JSON.parse(stored) as PendingTurboSend;
  return {
    ...pending,
    unit: normalizeStoredTurboUnit(pending.unit),
  };
};

const turboSendStorageKey = (
  senderTaprootAddress: string,
  quoteId: string,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): string =>
  unit === DEFAULT_CASHU_UNIT
    ? `${PENDING_TURBO_SEND_KEY}_${safeStorageSegment(senderTaprootAddress)}_${safeStorageSegment(quoteId)}`
    : `${PENDING_TURBO_SEND_KEY}_${safeStorageSegment(senderTaprootAddress)}_${safeStorageSegment(quoteId)}_${unit}`;

const quarantineCorruptTurboSendRegistry = async (
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${PENDING_TURBO_SEND_REGISTRY_KEY}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('[TurboRecovery] Quarantined corrupt turbo send registry', {
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('[TurboRecovery] Failed to quarantine corrupt turbo send registry', {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const loadTurboSendRegistry = async (strict = false): Promise<string[]> => {
  const stored = await SecureStore.getItemAsync(PENDING_TURBO_SEND_REGISTRY_KEY);
  if (!stored) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored) as unknown;
  } catch (error) {
    await quarantineCorruptTurboSendRegistry(stored, 'invalid JSON');
    logger.error('[TurboRecovery] Failed to parse turbo send registry', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (strict) {
      throw new Error('Turbo send registry corrupted: invalid JSON');
    }
    return [];
  }

  if (!Array.isArray(parsed)) {
    await quarantineCorruptTurboSendRegistry(stored, 'invalid registry');
    if (strict) {
      throw new Error('Turbo send registry corrupted: invalid registry');
    }
    return [];
  }

  return parsed.filter((key): key is string => typeof key === 'string');
};

const saveTurboSendRegistry = async (keys: string[]): Promise<void> => {
  await SecureStore.setItemAsync(
    PENDING_TURBO_SEND_REGISTRY_KEY,
    JSON.stringify(Array.from(new Set(keys))),
    DEVICE_ONLY
  );
};

const loadTurboSendEntryForKey = async (
  storageKey: string,
  legacy = false
): Promise<PendingTurboSendEntry | null> => {
  const stored = await SecureStore.getItemAsync(storageKey);
  if (!stored) {
    return null;
  }

  return {
    pending: parsePendingTurboSend(stored),
    storageKey,
    legacy,
  };
};

const deleteTurboSendEntry = async (entry: PendingTurboSendEntry): Promise<void> => {
  const registry = await loadTurboSendRegistry();
  const remainingRegistryKeys: string[] = [];

  for (const key of registry) {
    let shouldDelete = key === entry.storageKey;

    if (!shouldDelete) {
      try {
        const candidate = await loadTurboSendEntryForKey(key);
        shouldDelete = !!candidate && isSameTurboSend(candidate.pending, entry.pending);
      } catch (error) {
        logger.warn('[TurboRecovery] Failed to inspect turbo send during cleanup', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (shouldDelete) {
      await SecureStore.deleteItemAsync(key);
    } else {
      remainingRegistryKeys.push(key);
    }
  }

  if (entry.legacy || !registry.includes(entry.storageKey)) {
    await SecureStore.deleteItemAsync(entry.storageKey);
  }

  if (remainingRegistryKeys.length !== registry.length) {
    await saveTurboSendRegistry(remainingRegistryKeys);
  }

  const legacyEntry = await loadTurboSendEntryForKey(PENDING_TURBO_SEND_KEY, true).catch(() => null);
  if (legacyEntry && (entry.legacy || isSameTurboSend(legacyEntry.pending, entry.pending))) {
    await SecureStore.deleteItemAsync(PENDING_TURBO_SEND_KEY);
  }
};

const isCurrentAccountTurboSend = (pending: PendingTurboSend): boolean => {
  const currentAccount = getCurrentCashuAccount();
  if (!pending.senderTaprootAddress) {
    return true;
  }
  if (!currentAccount) {
    return false;
  }
  return pending.senderTaprootAddress === currentAccount;
};

const matchesTurboSendSelector = (
  pending: PendingTurboSend,
  selector?: PendingTurboSendSelector
): boolean => {
  if (!selector) {
    return isCurrentAccountTurboSend(pending);
  }

  if (selector.quoteId && pending.quoteId !== selector.quoteId) {
    return false;
  }

  if (
    selector.senderTaprootAddress &&
    pending.senderTaprootAddress !== selector.senderTaprootAddress
  ) {
    return false;
  }

  if (selector.unit && (pending.unit ?? DEFAULT_CASHU_UNIT) !== selector.unit) {
    return false;
  }

  if (selector.recipient && pending.recipient !== selector.recipient) {
    return false;
  }

  if (selector.amount !== undefined && pending.amount !== selector.amount) {
    return false;
  }

  return true;
};

const isSameTurboSend = (a: PendingTurboSend, b: PendingTurboSend): boolean =>
  a.quoteId === b.quoteId &&
  a.senderTaprootAddress === b.senderTaprootAddress &&
  (a.unit ?? DEFAULT_CASHU_UNIT) === (b.unit ?? DEFAULT_CASHU_UNIT);

export const getMinimumTurboBalanceAfterMint = (pending: PendingTurboSend): number => {
  const mintAmount = pending.mintAmount ?? pending.amount;
  if (pending.preMintBalance === undefined) {
    return pending.amount;
  }
  return Math.max(pending.amount, pending.preMintBalance + mintAmount);
};

const isExpiredWaitingForMintTurboSend = (pending: PendingTurboSend): boolean => {
  const EXPIRY_MS = 24 * 60 * 60 * 1000;
  return Date.now() - pending.createdAt > EXPIRY_MS && pending.stage === 'waiting_for_mint';
};

const shouldDeleteExpiredWaitingTurboSend = async (entry: PendingTurboSendEntry): Promise<boolean> => {
  const { pending } = entry;
  if (!isExpiredWaitingForMintTurboSend(pending)) {
    return false;
  }

  try {
    const mintStatus = await checkMintStatus(pending.quoteId);
    if (
      mintStatus.paid ||
      mintStatus.availableAmount > 0 ||
      mintStatus.state === 'PAID' ||
      mintStatus.state === 'ISSUED'
    ) {
      logger.info('[TurboRecovery] Keeping expired turbo send because quote is recoverable', {
        quoteId: pending.quoteId.substring(0, 8),
        state: mintStatus.state,
        availableAmount: mintStatus.availableAmount,
        unit: pending.unit ?? DEFAULT_CASHU_UNIT,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('[TurboRecovery] Keeping expired turbo send because mint status check failed', {
      quoteId: pending.quoteId.substring(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const turboSendRecoveryRank = (entry: PendingTurboSendEntry): number => {
  if (entry.pending.stage === 'p2pk_created' && entry.pending.token) {
    return 4;
  }
  if (entry.pending.stage === 'p2pk_created') {
    return 3;
  }
  if (entry.pending.stage === 'mint_completed') {
    return 2;
  }
  return 1;
};

const turboSendRecoveryKey = (pending: PendingTurboSend): string =>
  [
    pending.quoteId,
    pending.senderTaprootAddress,
    pending.unit ?? DEFAULT_CASHU_UNIT,
  ].join(':');

const chooseRecoverableTurboSendEntry = (
  current: PendingTurboSendEntry,
  candidate: PendingTurboSendEntry
): PendingTurboSendEntry => {
  const currentRank = turboSendRecoveryRank(current);
  const candidateRank = turboSendRecoveryRank(candidate);

  if (candidateRank !== currentRank) {
    return candidateRank > currentRank ? candidate : current;
  }

  if (candidate.pending.createdAt !== current.pending.createdAt) {
    return candidate.pending.createdAt > current.pending.createdAt ? candidate : current;
  }

  return current.legacy && !candidate.legacy ? candidate : current;
};

const mergePendingTurboSendEntries = (
  entries: PendingTurboSendEntry[]
): PendingTurboSendEntry[] => {
  const byRecoveryKey = new Map<string, PendingTurboSendEntry>();

  for (const entry of entries) {
    const key = turboSendRecoveryKey(entry.pending);
    const existing = byRecoveryKey.get(key);
    byRecoveryKey.set(
      key,
      existing ? chooseRecoverableTurboSendEntry(existing, entry) : entry
    );
  }

  return Array.from(byRecoveryKey.values());
};

const loadPendingTurboSendEntries = async (
  selector?: PendingTurboSendSelector
): Promise<PendingTurboSendEntry[]> => {
  const registry = await loadTurboSendRegistry();
  const entries: PendingTurboSendEntry[] = [];

  for (const key of registry) {
    try {
      const entry = await loadTurboSendEntryForKey(key);
      if (entry) {
        entries.push(entry);
      }
    } catch (error) {
      logger.error('[TurboRecovery] Failed to load pending turbo send entry', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const legacyEntry = await loadTurboSendEntryForKey(PENDING_TURBO_SEND_KEY, true);
    if (legacyEntry) {
      entries.push(legacyEntry);
    }
  } catch (error) {
    logger.error('[TurboRecovery] Failed to load legacy pending turbo send', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const sortedEntries = mergePendingTurboSendEntries(entries)
    .sort((a, b) => a.pending.createdAt - b.pending.createdAt);
  const matchingEntries: PendingTurboSendEntry[] = [];
  for (const entry of sortedEntries) {
    if (!matchesTurboSendSelector(entry.pending, selector)) {
      continue;
    }

    if (await shouldDeleteExpiredWaitingTurboSend(entry)) {
      logger.info('[TurboRecovery] Pending turbo send expired, removing');
      await deleteTurboSendEntry(entry);
      continue;
    }

    matchingEntries.push(entry);
  }

  return matchingEntries;
};

const loadPendingTurboSendEntry = async (
  selector?: PendingTurboSendSelector
): Promise<PendingTurboSendEntry | null> => {
  const entries = await loadPendingTurboSendEntries(selector);
  return entries[0] ?? null;
};

const updateTurboSendEntry = async (
  entry: PendingTurboSendEntry,
  stage: PendingTurboSend['stage'],
  data?: { token?: string; shortUrl?: string }
): Promise<void> => {
  const { pending } = entry;
  pending.stage = stage;
  if (data?.token) pending.token = data.token;
  if (data?.shortUrl) pending.shortUrl = data.shortUrl;
  await SecureStore.setItemAsync(entry.storageKey, JSON.stringify(pending), DEVICE_ONLY);
  await SecureStore.setItemAsync(PENDING_TURBO_SEND_KEY, JSON.stringify(pending), DEVICE_ONLY);
  logger.debug('[TurboRecovery] Updated turbo send stage', { stage, hasToken: !!data?.token });
};

const shortenTokenWithFallback = async (
  token: string,
  shortenToken: (token: string) => Promise<string>
): Promise<string> => {
  try {
    return await shortenToken(token);
  } catch (error) {
    logger.warn('[TurboRecovery] Failed to shorten token; using direct deeplink fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return `ducat://turbo/${token}`;
  }
};

/**
 * Save a pending turbo send before starting the flow
 * This ensures we can resume if the app crashes
 */
export const savePendingTurboSend = async (
  quoteId: string,
  recipient: string,
  amount: number,
  senderTaprootAddress: string,
  unit: CashuUnit = DEFAULT_CASHU_UNIT,
  mintAmount?: number
): Promise<void> => {
  try {
    const existingEntry = await loadPendingTurboSendEntry({ quoteId, senderTaprootAddress, unit });
    if (
      existingEntry &&
      (existingEntry.pending.stage !== 'waiting_for_mint' || existingEntry.pending.token)
    ) {
      logger.info('[TurboRecovery] Existing pending turbo send is already advanced; not overwriting', {
        quoteId: quoteId.substring(0, 8),
        stage: existingEntry.pending.stage,
        unit,
      });
      return;
    }

    const pendingSend: PendingTurboSend = {
      quoteId,
      recipient,
      amount,
      senderTaprootAddress,
      createdAt: Date.now(),
      stage: 'waiting_for_mint',
    };
    if (mintAmount !== undefined && mintAmount !== amount) {
      pendingSend.mintAmount = mintAmount;
    }
    pendingSend.preMintBalance = await getBalance(true, unit);
    if (unit !== DEFAULT_CASHU_UNIT) {
      pendingSend.unit = unit;
    }

    const storageKey = turboSendStorageKey(senderTaprootAddress, quoteId, unit);
    await SecureStore.setItemAsync(
      PENDING_TURBO_SEND_KEY,
      JSON.stringify(pendingSend),
      DEVICE_ONLY
    );
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify(pendingSend),
      DEVICE_ONLY
    );
    try {
      const registry = await loadTurboSendRegistry(true);
      await saveTurboSendRegistry([...registry, storageKey]);
    } catch (registryError) {
      logger.warn('[TurboRecovery] Failed to update turbo send registry; relying on legacy fallback', {
        error: registryError instanceof Error ? registryError.message : String(registryError),
      });
      await SecureStore.setItemAsync(
        PENDING_TURBO_SEND_KEY,
        JSON.stringify(pendingSend),
        DEVICE_ONLY
      );
    }

    logger.info('[TurboRecovery] Saved pending turbo send', {
      quoteId: quoteId.substring(0, 8),
      recipient: recipient.substring(0, 12) + '...',
      amount,
      unit,
    });
  } catch (error) {
    logger.error('[TurboRecovery] Failed to save pending turbo send', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Update the stage of a pending turbo send
 * @param stage - New stage
 * @param data - Optional additional data to persist (e.g., token for crash recovery)
 */
export const updateTurboSendStage = async (
  stage: PendingTurboSend['stage'],
  data?: { token?: string; shortUrl?: string },
  selector?: PendingTurboSendSelector
): Promise<void> => {
  try {
    const entry = await loadPendingTurboSendEntry(selector);
    if (entry) {
      await updateTurboSendEntry(entry, stage, data);
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
export const loadPendingTurboSend = async (
  selector?: PendingTurboSendSelector
): Promise<PendingTurboSend | null> => {
  try {
    const entry = await loadPendingTurboSendEntry(selector);
    return entry?.pending ?? null;
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
export const clearPendingTurboSend = async (
  selector?: PendingTurboSendSelector
): Promise<void> => {
  try {
    const entry = await loadPendingTurboSendEntry(selector);
    if (entry) {
      await deleteTurboSendEntry(entry);
    } else if (!selector) {
      await SecureStore.deleteItemAsync(PENDING_TURBO_SEND_KEY);
    }
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

const recoverPendingTurboSendEntry = async (
  entry: PendingTurboSendEntry,
  sendP2PKToken: (
    amount: number,
    pubkey: string,
    options: Record<string, unknown>,
    onProgress?: (current: number, total: number, message: string) => void,
    recipientAddressForRecovery?: string | null,
    unit?: CashuUnit
  ) => Promise<{ token: string } | null>,
  extractPubkey: (address: string) => string | null,
  shortenToken: (token: string) => Promise<string>,
  saveToken: (
    token: string,
    recipient: string,
    amount: number,
    txid: string | null,
    shortUrl: string | null,
    senderAddress: string | undefined,
    unit?: CashuUnit
  ) => Promise<void>
): Promise<TurboRecoveryResult> => {
  try {
    const pending = entry.pending;
    const pendingUnit = pending.unit ?? DEFAULT_CASHU_UNIT;

    logger.info('[TurboRecovery] Found pending turbo send, attempting recovery', {
      quoteId: pending.quoteId.substring(0, 8),
      stage: pending.stage,
      recipient: pending.recipient.substring(0, 12) + '...',
      amount: pending.amount,
      unit: pendingUnit,
    });

    // If we're still waiting for mint, the mint quote recovery will handle it
    // We also check the mint directly so a crash after completeMint but before
    // updating this stage cannot leave the Turbo send stuck forever.
    if (pending.stage === 'waiting_for_mint') {
      const mintStatus = await checkMintStatus(pending.quoteId);
      if (mintStatus.availableAmount > 0 || mintStatus.state === 'PAID') {
        const claimAmount =
          mintStatus.availableAmount > 0 ? mintStatus.availableAmount : (pending.mintAmount ?? pending.amount);
        if (pendingUnit === DEFAULT_CASHU_UNIT) {
          await completeMint(pending.quoteId, claimAmount);
        } else {
          await completeMint(pending.quoteId, claimAmount, pendingUnit);
        }
        await updateTurboSendEntry(entry, 'mint_completed');
        pending.stage = 'mint_completed';
        logger.info('[TurboRecovery] Recovered completed mint for waiting turbo send', {
          quoteId: pending.quoteId.substring(0, 8),
          amount: claimAmount,
        });
      } else if (mintStatus.state === 'ISSUED') {
        logger.info(
          '[TurboRecovery] Mint already issued for waiting turbo send, resuming P2PK creation',
          {
            quoteId: pending.quoteId.substring(0, 8),
            state: mintStatus.state,
          }
        );
      } else {
        logger.debug('[TurboRecovery] Still waiting for mint payment');
        return { recovered: false };
      }

      const spendableBalance = await getBalance(true, pendingUnit);
      const minimumRecoveredBalance = getMinimumTurboBalanceAfterMint(pending);
      if (spendableBalance < minimumRecoveredBalance) {
        logger.warn('[TurboRecovery] Mint is issued but Turbo balance is not spendable yet', {
          quoteId: pending.quoteId.substring(0, 8),
          required: minimumRecoveredBalance,
          spendableBalance,
          unit: pendingUnit,
        });
        return {
          recovered: false,
          error: 'Mint issued but recovered proofs are not spendable yet',
        };
      }

      await updateTurboSendEntry(entry, 'mint_completed');
      pending.stage = 'mint_completed';
    }

    // Mint completed but P2PK not created/sent - resume from here
    if (pending.stage === 'mint_completed') {
      logger.info('[TurboRecovery] Mint was completed, resuming P2PK token creation');

      const recipientPubkey = extractPubkey(pending.recipient);
      if (!recipientPubkey) {
        throw new Error('Failed to extract pubkey from recipient address');
      }

      // Create P2PK token
      const result = pendingUnit === DEFAULT_CASHU_UNIT
        ? await sendP2PKToken(
            pending.amount,
            recipientPubkey,
            {},
            undefined,
            pending.recipient
          )
        : await sendP2PKToken(
            pending.amount,
            recipientPubkey,
            {},
            undefined,
            pending.recipient,
            pendingUnit
          );
      if (!result?.token) {
        throw new Error('sendP2PKToken returned no token');
      }

      logger.info('[TurboRecovery] P2PK token created successfully');

      // Persist the token before any URL/history work so another crash can retry safely.
      await updateTurboSendEntry(entry, 'p2pk_created', { token: result.token });
      if (pendingUnit === DEFAULT_CASHU_UNIT) {
        await saveToken(
          result.token,
          pending.recipient,
          pending.amount,
          null,
          null,
          pending.senderTaprootAddress
        );
      } else {
        await saveToken(
          result.token,
          pending.recipient,
          pending.amount,
          null,
          null,
          pending.senderTaprootAddress,
          pendingUnit
        );
      }

      // Generate shortened URL
      const shortUrl = await shortenTokenWithFallback(result.token, shortenToken);
      await updateTurboSendEntry(entry, 'p2pk_created', { token: result.token, shortUrl });
      logger.info('[TurboRecovery] Generated short URL', { shortUrlLength: shortUrl.length });

      // Save the token
      if (pendingUnit === DEFAULT_CASHU_UNIT) {
        await saveToken(
          result.token,
          pending.recipient,
          pending.amount,
          null,
          shortUrl,
          pending.senderTaprootAddress
        );
      } else {
        await saveToken(
          result.token,
          pending.recipient,
          pending.amount,
          null,
          shortUrl,
          pending.senderTaprootAddress,
          pendingUnit
        );
      }
      try {
        await clearRecoveredOutgoingSwapToken(result.token);
      } catch (cleanupError) {
        logger.warn('[TurboRecovery] Outgoing swap token cleanup failed after durable save', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          unit: pendingUnit,
        });
      }
      logger.info('[TurboRecovery] Token saved successfully');

      // Clear the pending send
      await deleteTurboSendEntry(entry);

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
      const shortUrl = pending.shortUrl || (await shortenTokenWithFallback(pending.token, shortenToken));
      await updateTurboSendEntry(entry, 'p2pk_created', { token: pending.token, shortUrl });
      // Re-save the locked token
      if (pendingUnit === DEFAULT_CASHU_UNIT) {
        await saveToken(
          pending.token,
          pending.recipient,
          pending.amount,
          null,
          shortUrl,
          pending.senderTaprootAddress
        );
      } else {
        await saveToken(
          pending.token,
          pending.recipient,
          pending.amount,
          null,
          shortUrl,
          pending.senderTaprootAddress,
          pendingUnit
        );
      }
      try {
        await clearRecoveredOutgoingSwapToken(pending.token);
      } catch (cleanupError) {
        logger.warn('[TurboRecovery] Outgoing swap token cleanup failed after recovery save', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          unit: pendingUnit,
        });
      }
      logger.info('[TurboRecovery] Re-saved token from recovery data');

      await deleteTurboSendEntry(entry);
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

export const recoverPendingTurboSend = async (
  sendP2PKToken: (
    amount: number,
    pubkey: string,
    options: Record<string, unknown>,
    onProgress?: (current: number, total: number, message: string) => void,
    recipientAddressForRecovery?: string | null,
    unit?: CashuUnit
  ) => Promise<{ token: string } | null>,
  extractPubkey: (address: string) => string | null,
  shortenToken: (token: string) => Promise<string>,
  saveToken: (
    token: string,
    recipient: string,
    amount: number,
    txid: string | null,
    shortUrl: string | null,
    senderAddress: string | undefined,
    unit?: CashuUnit
  ) => Promise<void>
): Promise<TurboRecoveryResult> => {
  try {
    const entries = await loadPendingTurboSendEntries();

    if (entries.length === 0) {
      return { recovered: false };
    }

    let firstRecoveredResult: TurboRecoveryResult | null = null;
    let lastError: string | undefined;
    for (const entry of entries) {
      const result = await recoverPendingTurboSendEntry(
        entry,
        sendP2PKToken,
        extractPubkey,
        shortenToken,
        saveToken
      );

      if (result.recovered) {
        firstRecoveredResult ??= result;
        continue;
      }

      if (result.error) {
        lastError = result.error;
      }
    }

    if (firstRecoveredResult) {
      return firstRecoveredResult;
    }

    return lastError ? { recovered: false, error: lastError } : { recovered: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[TurboRecovery] Recovery scan failed', { error: errorMsg });
    return { recovered: false, error: errorMsg };
  }
};
