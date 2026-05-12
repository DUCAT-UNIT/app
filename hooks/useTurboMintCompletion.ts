import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import {
  checkMintQuote,
  completeMint,
  getBalance,
  getMintQuoteAvailableAmount,
  sendP2PKToken,
} from '../services/cashu/cashuWalletService';
import { getCurrentCashuAccount } from '../services/cashu/cashuProofManager';
import { extractPubkeyFromTaprootAddress } from '../utils/bitcoin';
import {
  generateTurboDeeplink,
  saveSentLockedToken,
} from '../services/cashu/cashuLockedTokensService';
import { clearRecoveredOutgoingSwapToken } from '../services/cashu/cashuSwapRecovery';
import { notify } from '../utils/notify';
import {
  savePendingTurboSend,
  updateTurboSendStage,
  clearPendingTurboSend,
  loadPendingTurboSend,
  getMinimumTurboBalanceAfterMint,
} from '../services/cashu/cashuTurboRecovery';
import { recoverUnclaimedMintQuotes } from '../services/cashu/cashuMintQuoteRecovery';
import { DEFAULT_CASHU_UNIT, type CashuUnit } from '../services/cashu/cashuUnits';

type ProcessingStage = 'converting' | 'awaiting_confirmation' | 'error' | 'ready';

const MINT_CONFIRMATION_POLL_MS = 2000;
const MAX_MINT_CONFIRMATION_ATTEMPTS = 90;
const CASHU_OPERATION_TIMEOUT_MS = 20000;

const rejectAfter = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    (timeout as { unref?: () => void }).unref?.();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
};

interface UseTurboMintCompletionParams {
  isTurbo: boolean;
  mintQuoteId: string | null;
  mintAmount: number;
  mintClaimAmount?: number;
  turboRecipient: string | null;
  cashuUnit?: CashuUnit;
  skipMint: boolean;
  senderTaprootAddress: string | undefined;
  fetchTransactionHistory: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  refreshCashuBalance: () => Promise<void>;
}

interface UseTurboMintCompletionReturn {
  turboToken: string | null;
  turboDeeplink: string | null;
  processingStage: ProcessingStage;
  processingMessage: string | null;
  isCompletingMint: boolean;
}

type MintQuoteLike = Awaited<ReturnType<typeof checkMintQuote>>;

const hasMintAccounting = (quote: MintQuoteLike): boolean =>
  quote.amount_paid !== undefined || quote.amount_issued !== undefined;

const isQuoteReadyToMint = (quote: MintQuoteLike): boolean => {
  const availableAmount = getMintQuoteAvailableAmount(quote);

  if (availableAmount > 0) {
    return true;
  }

  if (!hasMintAccounting(quote)) {
    return quote.state === 'PAID' || quote.state === 'ISSUED';
  }

  return (quote.amount_paid ?? 0) > 0 && (quote.amount_issued ?? 0) >= (quote.amount_paid ?? 0);
};

const isQuoteAlreadyIssued = (quote: MintQuoteLike): boolean =>
  quote.state === 'ISSUED' ||
  (hasMintAccounting(quote) &&
    (quote.amount_paid ?? 0) > 0 &&
    (quote.amount_issued ?? 0) >= (quote.amount_paid ?? 0) &&
    getMintQuoteAvailableAmount(quote) === 0);

const getClaimAmount = (quote: MintQuoteLike, fallbackAmount: number): number => {
  const availableAmount = getMintQuoteAvailableAmount(quote);
  return availableAmount > 0 ? availableAmount : (quote.amount ?? fallbackAmount);
};

const isDefaultCashuUnit = (unit: CashuUnit): boolean => unit === DEFAULT_CASHU_UNIT;

/**
 * Hook to handle Turbo mint completion flow
 * - Polls for payment confirmation
 * - Completes mint to get e-cash tokens
 * - Creates P2PK locked token for recipient
 * - Generates shortened URL deeplink
 * - Manages processing stages
 */
export function useTurboMintCompletion({
  isTurbo,
  mintQuoteId,
  mintAmount,
  mintClaimAmount,
  turboRecipient,
  cashuUnit = DEFAULT_CASHU_UNIT,
  skipMint,
  senderTaprootAddress,
  fetchTransactionHistory,
  fetchBalance,
  refreshCashuBalance,
}: UseTurboMintCompletionParams): UseTurboMintCompletionReturn {
  const [turboToken, setTurboToken] = useState<string | null>(null);
  const [turboDeeplink, setTurboDeeplink] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(
    skipMint || !isTurbo ? 'ready' : 'converting'
  );
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const hasMintCompleted = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    logger.debug('[useTurboMintCompletion] Checking mint completion:', {
      isTurbo,
      skipMint,
      mintQuoteId,
      hasMintCompleted: hasMintCompleted.current,
    });

    // Only proceed if this is a Turbo flow that needs mint completion
    if (!isTurbo || skipMint || !mintQuoteId) {
      logger.debug('[useTurboMintCompletion] Not a turbo mint flow, skipping');
      return;
    }

    if (!senderTaprootAddress) {
      logger.warn('[useTurboMintCompletion] Waiting for sender Taproot address before starting');
      setProcessingMessage('Preparing wallet context...');
      return;
    }

    if (hasMintCompleted.current) {
      logger.debug('[useTurboMintCompletion] Mint already completed, skipping');
      return;
    }

    hasMintCompleted.current = true;
    logger.debug('[useTurboMintCompletion] Starting mint completion process');
    setProcessingMessage(null);

    const completeMintProcess = async () => {
      if (!mountedRef.current) return;
      setIsCompletingMint(true);
      const recoverySenderTaprootAddress = senderTaprootAddress;
      try {
        const assertSenderAccountActive = (operation: string): void => {
          const currentAccount = getCurrentCashuAccount();
          if (currentAccount !== recoverySenderTaprootAddress) {
            throw new Error(
              `Cashu account changed during ${operation}; switch back to the sender account to recover this Turbo send`
            );
          }
        };
        const recoverySelector = {
          quoteId: mintQuoteId,
          senderTaprootAddress: recoverySenderTaprootAddress,
          unit: cashuUnit,
        };
        assertSenderAccountActive('Turbo mint recovery setup');
        // Save pending turbo send state BEFORE starting (for crash recovery)
        if (turboRecipient) {
          await savePendingTurboSend(
            mintQuoteId,
            turboRecipient,
            mintAmount,
            recoverySenderTaprootAddress,
            cashuUnit,
            mintClaimAmount
          );
        }

        logger.debug('[useTurboMintCompletion] Starting to poll for payment confirmation');

        // Poll for payment confirmation
        // Mutinynet blocks ~30s + Ord indexing + mint deposit monitor (30s poll)
        // Need at least 120s to reliably catch deposits. After that, move to
        // a recoverable pending state instead of trapping the user on a spinner.
        let paidQuote: MintQuoteLike | null = null;
        let attempts = 0;

        while (!paidQuote && attempts < MAX_MINT_CONFIRMATION_ATTEMPTS) {
          if (!mountedRef.current) return;
          await new Promise((resolve) => setTimeout(resolve, MINT_CONFIRMATION_POLL_MS));
          if (!mountedRef.current) return;
          try {
            const quote = await rejectAfter(
              checkMintQuote(mintQuoteId),
              CASHU_OPERATION_TIMEOUT_MS,
              'Checking Turbo mint status'
            );
            logger.debug(
              `[useTurboMintCompletion] Check ${attempts + 1}/${MAX_MINT_CONFIRMATION_ATTEMPTS}:`,
              quote
            );
            if (isQuoteReadyToMint(quote)) {
              paidQuote = quote;
              break;
            }
          } catch (pollError: unknown) {
            logger.warn(
              `[useTurboMintCompletion] Poll ${attempts + 1}/${MAX_MINT_CONFIRMATION_ATTEMPTS} failed, retrying`,
              {
                error: pollError instanceof Error ? pollError.message : String(pollError),
              }
            );
          }
          attempts++;
        }

        if (!mountedRef.current) return;

        if (paidQuote) {
          const claimAmount = getClaimAmount(paidQuote, mintClaimAmount ?? mintAmount);

          if (claimAmount <= 0) {
            throw new Error('Mint quote has no claimable amount');
          }

          assertSenderAccountActive('Turbo mint completion');
          if (isQuoteAlreadyIssued(paidQuote)) {
            logger.debug(
              '[useTurboMintCompletion] Mint quote already issued, continuing with existing proofs',
              {
                quoteId: mintQuoteId,
                amountPaid: paidQuote.amount_paid,
                amountIssued: paidQuote.amount_issued,
              }
            );
            try {
              const recoveryResult = await rejectAfter(
                recoverUnclaimedMintQuotes(),
                CASHU_OPERATION_TIMEOUT_MS,
                'Recovering issued Turbo mint'
              );
              if (recoveryResult.errors.length > 0) {
                logger.warn('[useTurboMintCompletion] Issued Turbo mint recovery had errors', {
                  errors: recoveryResult.errors,
                });
              }
            } catch (recoveryError) {
              logger.warn('[useTurboMintCompletion] Issued Turbo mint recovery failed', {
                error:
                  recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
              });
            }
            const pendingTurboSend = await loadPendingTurboSend(recoverySelector);
            const spendableBalance = await rejectAfter(
              getBalance(true, cashuUnit),
              CASHU_OPERATION_TIMEOUT_MS,
              'Checking recovered Turbo balance'
            );
            const minimumRecoveredBalance = pendingTurboSend
              ? getMinimumTurboBalanceAfterMint(pendingTurboSend)
              : mintAmount;
            if (spendableBalance < minimumRecoveredBalance) {
              throw new Error(
                `Mint quote is issued but recovered Turbo balance is not spendable yet (need ${minimumRecoveredBalance}, have ${spendableBalance})`
              );
            }
          } else {
            logger.debug(
              '[useTurboMintCompletion] Payment confirmed! Completing mint with amount:',
              claimAmount
            );
            // Complete mint to get e-cash tokens - amount is in smallest units
            const proofs = isDefaultCashuUnit(cashuUnit)
              ? await rejectAfter(
                  completeMint(mintQuoteId, claimAmount),
                  CASHU_OPERATION_TIMEOUT_MS,
                  'Completing Turbo mint'
                )
              : await rejectAfter(
                  completeMint(mintQuoteId, claimAmount, cashuUnit),
                  CASHU_OPERATION_TIMEOUT_MS,
                  'Completing Turbo mint'
                );
            if (!mountedRef.current) return;
            logger.debug(
              '[useTurboMintCompletion] Mint completed successfully, received proofs:',
              proofs?.length
            );
          }

          // Update stage: mint completed
          await updateTurboSendStage('mint_completed', undefined, recoverySelector);

          // If we have a turbo recipient, create a P2PK locked token
          if (turboRecipient) {
            try {
              assertSenderAccountActive('Turbo P2PK token creation');
              logger.debug(
                '[useTurboMintCompletion] Creating P2PK locked token for recipient:',
                turboRecipient
              );

              // Extract pubkey from P2TR address
              const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);
              logger.debug('[useTurboMintCompletion] Extracted recipient pubkey:', recipientPubkey);

              if (!recipientPubkey) {
                throw new Error('Failed to extract pubkey from recipient address');
              }

              // Send exactly the mint amount as P2PK locked token
              logger.debug('[useTurboMintCompletion] Creating P2PK token for amount:', mintAmount);
              const boundedResult = await rejectAfter(
                sendP2PKToken(
                  mintAmount,
                  recipientPubkey,
                  {},
                  undefined,
                  turboRecipient,
                  ...(isDefaultCashuUnit(cashuUnit) ? [] : [cashuUnit])
                ),
                CASHU_OPERATION_TIMEOUT_MS,
                'Creating Turbo token'
              );
              logger.debug('[useTurboMintCompletion] sendP2PKToken result:', {
                hasToken: !!boundedResult?.token,
                resultType: typeof boundedResult,
              });
              const token = boundedResult?.token;
              if (!token) {
                throw new Error('sendP2PKToken returned no token');
              }
              logger.debug('[useTurboMintCompletion] P2PK token created', {
                tokenLength: token.length,
              });

              // SECURITY: Save token in recovery state IMMEDIATELY after creation.
              // If app crashes before saveSentLockedToken, recovery can re-save.
              await updateTurboSendStage('p2pk_created', { token }, recoverySelector);
              if (isDefaultCashuUnit(cashuUnit)) {
                await saveSentLockedToken(
                  token,
                  turboRecipient,
                  mintAmount,
                  null,
                  null,
                  recoverySenderTaprootAddress
                );
              } else {
                await saveSentLockedToken(
                  token,
                  turboRecipient,
                  mintAmount,
                  null,
                  null,
                  recoverySenderTaprootAddress,
                  cashuUnit
                );
              }

              // Generate shortened URL for the token
              const shortUrl = await generateTurboDeeplink(token, turboRecipient, mintAmount);
              logger.debug('[useTurboMintCompletion] Generated short URL', {
                shortUrlLength: shortUrl.length,
              });
              if (mountedRef.current) {
                setTurboDeeplink(shortUrl);
              }

              // Store the sent P2PK token
              // saveSentLockedToken(token, recipient, amount, txid, shortUrl, taprootAddress)
              if (isDefaultCashuUnit(cashuUnit)) {
                await saveSentLockedToken(
                  token,
                  turboRecipient,
                  mintAmount,
                  null,
                  shortUrl,
                  recoverySenderTaprootAddress
                );
              } else {
                await saveSentLockedToken(
                  token,
                  turboRecipient,
                  mintAmount,
                  null,
                  shortUrl,
                  recoverySenderTaprootAddress,
                  cashuUnit
                );
              }
              try {
                await clearRecoveredOutgoingSwapToken(token);
              } catch (cleanupError) {
                logger.warn(
                  '[useTurboMintCompletion] Outgoing swap token cleanup failed after durable save',
                  {
                    error:
                      cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                    cashuUnit,
                  }
                );
              }
              logger.debug('[useTurboMintCompletion] P2PK token stored successfully');

              // Clear pending turbo send - successfully completed!
              await clearPendingTurboSend(recoverySelector);

              // Store token for display
              if (mountedRef.current) {
                logger.debug(
                  '[useTurboMintCompletion] Setting turboToken state with token length:',
                  token?.length
                );
                setTurboToken(token);
                setProcessingMessage(null);
                setProcessingStage('ready'); // Transition to ready stage
                logger.debug(
                  '[useTurboMintCompletion] turboToken state has been set, transitioned to ready stage'
                );
              }
            } catch (storageError) {
              logger.error('[useTurboMintCompletion] Failed to generate/save token:', {
                error: storageError instanceof Error ? storageError.message : String(storageError),
              });
              // Keep pending turbo send recovery intact, but do not report success when
              // the recipient token is not durably available to the sender yet.
              throw storageError;
            }
          } else {
            // No turbo recipient - just transition to ready
            // Clear pending since there's no P2PK to send
            await clearPendingTurboSend(recoverySelector);
            setProcessingMessage(null);
            setProcessingStage('ready');
          }

          // Refresh all balances — Runes (ord indexer) + Cashu + TX history
          await Promise.all([fetchTransactionHistory(), fetchBalance()]);

          if (!mountedRef.current) return;
          setIsCompletingMint(false);

          // Refresh cashu balance to reflect the new tokens
          await refreshCashuBalance();
          logger.debug('[useTurboMintCompletion] Cashu balance refreshed');

          // Different message based on whether this is address-bound or regular Turbo
          if (turboRecipient) {
            notify.transaction.success('send');
          } else {
            notify.transaction.success('convert');
          }
        } else {
          logger.debug('[useTurboMintCompletion] Payment not confirmed after 10 minutes');
          // Don't clear pending turbo send - will resume polling on next app start
          if (mountedRef.current) {
            setProcessingStage('awaiting_confirmation');
            setProcessingMessage(
              'Payment sent. The Turbo token will finish automatically once the mint sees the confirmation.'
            );
            setIsCompletingMint(false);
          }
          notify.cashu.paymentSentAwaiting();
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[useTurboMintCompletion] Error during mint completion:', {
          error: errorMessage,
        });
        // Don't clear pending turbo send - will retry on next app start
        if (mountedRef.current) {
          setProcessingStage('error');
          setProcessingMessage(errorMessage);
          setIsCompletingMint(false);
        }
        notify.cashu.conversionFailed(errorMessage);
      }
    };

    completeMintProcess();

    return () => {
      mountedRef.current = false;
    };
  }, [
    isTurbo,
    mintQuoteId,
    mintAmount,
    mintClaimAmount,
    turboRecipient,
    cashuUnit,
    skipMint,
    senderTaprootAddress,
    fetchTransactionHistory,
    fetchBalance,
    refreshCashuBalance,
  ]);

  return {
    turboToken,
    turboDeeplink,
    processingStage,
    processingMessage,
    isCompletingMint,
  };
}
