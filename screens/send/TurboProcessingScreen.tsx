/**
 * TurboProcessingScreen - Processing screen for Turbo token creation
 * Shows progress during: selecting proofs, creating secrets, swapping, shortening URL
 * Persists state to survive app restarts
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Alert, BackHandler } from 'react-native';
import { NavigationProp, RouteProp, StackActions } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useSendFlow } from '../../stores/sendFlowStore';
import { useWallet } from '../../contexts/WalletContext';
import { useTurboProcessingStore } from '../../stores/turboProcessingStore';
import { logger } from '../../utils/logger';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from '../../services/cashu/cashuUnits';
import { getCurrentCashuAccount } from '../../services/cashu/cashuProofManager';

/**
 * Props for TurboProcessingScreen
 */
interface TurboProcessingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<
    { params: { cashuUnit?: CashuUnit; senderTaprootAddress?: string } | undefined },
    'params'
  >;
}

export default function TurboProcessingScreen({
  navigation,
  route,
}: TurboProcessingScreenProps): React.JSX.Element {
  const { sendAmount, sendRecipient } = useSendFlow();
  const { wallet } = useWallet();
  const [currentMessage, setCurrentMessage] = useState('Starting...');
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;
  const hasStarted = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStepRef = useRef(currentStep);
  const currentMessageRef = useRef(currentMessage);
  const persistedUnit = useTurboProcessingStore((state) => state.cashuUnit);
  const persistedStartedAt = useTurboProcessingStore((state) => state.startedAt);
  const persistedSenderTaprootAddress = useTurboProcessingStore((state) => state.senderTaprootAddress);
  const cashuUnit = normalizeCashuUnit(route.params?.cashuUnit ?? persistedUnit, DEFAULT_CASHU_UNIT);
  const isBtcCashu = cashuUnit === 'sat';
  const senderTaprootAddress =
    persistedSenderTaprootAddress ?? route.params?.senderTaprootAddress ?? wallet?.taprootAddress;

  // Get store actions
  const { startProcessing, updateProgress, completeProcessing, failProcessing } =
    useTurboProcessingStore();

  useEffect(() => {
    currentStepRef.current = currentStep;
    currentMessageRef.current = currentMessage;
  }, [currentStep, currentMessage]);

  const clearProcessingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Prevent back navigation while processing
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prevent back button - transaction must complete
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Start token creation when screen mounts
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Persist state immediately
    startProcessing({ sendAmount, sendRecipient, cashuUnit, senderTaprootAddress });

    // Set a timeout to surface slow operations. This must not clear persisted
    // processing state: the Cashu swap/token operation may still be running or
    // recoverable after a slow mint/network response.
    timeoutRef.current = setTimeout(() => {
      logger.error('Token creation timeout - stuck on step:', {
        step: currentStepRef.current,
        message: currentMessageRef.current,
      });
      const slowMessage = `Still working: ${currentMessageRef.current}`;
      setCurrentMessage(slowMessage);
      void updateProgress(currentStepRef.current, slowMessage);
      Alert.alert(
        'Still working',
        'Turbo token creation is taking longer than expected. Keep this screen open; if the app closes, recovery will continue automatically.',
        [{ text: 'OK' }]
      );
    }, 60000); // 60 second timeout
    (timeoutRef.current as { unref?: () => void }).unref?.();

    const createToken = async () => {
      try {
        logger.info('TurboProcessing: Starting token creation', {
          amount: sendAmount,
          recipient: sendRecipient,
          cashuUnit,
          senderTaprootAddress,
        });

        const assertSenderAccountActive = (): void => {
          if (!senderTaprootAddress) {
            throw new Error('Wallet Taproot address unavailable for Turbo processing recovery');
          }
          const currentAccount = getCurrentCashuAccount();
          if (currentAccount !== senderTaprootAddress) {
            throw new Error('Cashu account changed during Turbo processing; switch back to the sender account to recover this Turbo send');
          }
        };
        assertSenderAccountActive();

        const amountInSmallestUnits = isBtcCashu
          ? Math.round(parseFloat(sendAmount) * 100_000_000)
          : Math.round(parseFloat(sendAmount) * 100);

        const completeWithDurableToken = async (
          token: string,
          existingShortUrl?: string | null
        ): Promise<void> => {
          const { generateTurboDeeplink, saveSentLockedToken } = await import(
            '../../services/cashu/cashuLockedTokensService'
          );

          await saveSentLockedToken(
            token,
            sendRecipient,
            amountInSmallestUnits,
            null,
            existingShortUrl ?? null,
            senderTaprootAddress,
            cashuUnit
          );

          const shortUrl = existingShortUrl
            ?? await generateTurboDeeplink(token, sendRecipient, amountInSmallestUnits);

          if (!existingShortUrl) {
            await saveSentLockedToken(
              token,
              sendRecipient,
              amountInSmallestUnits,
              null,
              shortUrl,
              senderTaprootAddress,
              cashuUnit
            );
          }

          clearProcessingTimeout();
          await completeProcessing();

          navigation.dispatch(
            StackActions.replace('Confirmation', {
              isTurbo: true,
              turboRecipient: sendRecipient,
              turboToken: token,
              turboAmount: amountInSmallestUnits,
              cashuUnit,
              skipMint: true,
            })
          );
        };

        const resumeExistingTokenIfPresent = async (): Promise<boolean> => {
          if (!persistedStartedAt) {
            return false;
          }

          const minimumTokenTimestamp = persistedStartedAt - 5000;
          const {
            generateTurboDeeplink,
            getSentLockedTokens,
          } = await import('../../services/cashu/cashuLockedTokensService');
          const sentTokens = await getSentLockedTokens(senderTaprootAddress ?? null);
          const matchingSentToken = sentTokens.find(
            (item) =>
              item.recipient === sendRecipient &&
              item.amount === amountInSmallestUnits &&
              (item.unit ?? DEFAULT_CASHU_UNIT) === cashuUnit &&
              item.timestamp >= minimumTokenTimestamp
          );

          if (matchingSentToken) {
            logger.info('TurboProcessing: Resuming with already saved token');
            const shortUrl = matchingSentToken.shortUrl
              ?? await generateTurboDeeplink(
                matchingSentToken.token,
                sendRecipient,
                amountInSmallestUnits
              );
            await completeWithDurableToken(matchingSentToken.token, shortUrl);
            return true;
          }

          const {
            checkAndRecoverSwaps,
            clearRecoveredOutgoingSwapToken,
            loadRecoveredOutgoingSwapTokens,
          } = await import('../../services/cashu/cashuSwapRecovery');
          await checkAndRecoverSwaps();
          const recoveredTokens = await loadRecoveredOutgoingSwapTokens();
          const matchingRecoveredToken = recoveredTokens.find(
            (item) =>
              item.kind === 'p2pk' &&
              item.recipient === sendRecipient &&
              item.amount === amountInSmallestUnits &&
              (item.unit ?? DEFAULT_CASHU_UNIT) === cashuUnit &&
              item.createdAt >= minimumTokenTimestamp
          );

          if (matchingRecoveredToken) {
            logger.info('TurboProcessing: Resuming with recovered outgoing token journal');
            await completeWithDurableToken(matchingRecoveredToken.token);
            try {
              await clearRecoveredOutgoingSwapToken(matchingRecoveredToken.token);
            } catch (cleanupError) {
              logger.warn('TurboProcessing: recovered token journal cleanup failed after durable save', {
                error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                cashuUnit,
              });
            }
            return true;
          }

          return false;
        };

        if (await resumeExistingTokenIfPresent()) {
          return;
        }

        assertSenderAccountActive();

        // Early balance check before attempting to create token
        const { getBalance } = await import('../../services/cashu/cashuBalanceService');
        const availableBalance = await getBalance(true, cashuUnit);

        if (availableBalance < amountInSmallestUnits) {
          // Not enough ecash - go back and show the insufficient sheet
          logger.warn('TurboProcessing: Insufficient ecash balance detected early', {
            available: availableBalance,
            required: amountInSmallestUnits,
            shortfall: amountInSmallestUnits - availableBalance,
          });

          clearProcessingTimeout();
          await failProcessing();

          // Navigate back to amount input with params to show insufficient sheet
          navigation.dispatch(
            StackActions.replace('SendInput', {
              assetType: isBtcCashu ? 'btc' : 'unit',
              prefillAddress: sendRecipient,
              prefillAmount: sendAmount,
              showInsufficientSheet: true,
              insufficientAmount: parseFloat(sendAmount),
              insufficientBalance: isBtcCashu ? availableBalance / 100_000_000 : availableBalance / 100,
              cashuUnit,
            })
          );
          return;
        }

        const { sendP2PKToken } = await import('../../services/cashu/cashuWalletService');

        // For P2PK, we need the tweaked output pubkey (extracted from the Taproot address)
        // This is the pubkey that's actually encoded in the tb1p... address
        // Extract the pubkey directly from the taproot address (works for any address, not just own wallet)
        const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
        const recipientPubkey = extractPubkeyFromTaprootAddress(sendRecipient); // Tweaked x-only pubkey (32 bytes / 64 hex chars)
        if (!recipientPubkey) {
          throw new Error('Recipient must be a valid Taproot address for Turbo sends');
        }

        logger.info('[TurboProcessingScreen] 🔐 P2PK TOKEN CREATION:', {
          recipientAddress: sendRecipient,
          tweakedPubkey: recipientPubkey,
          pubkeyLength: recipientPubkey.length,
        });

        // Create P2PK locked token with progress callback
        logger.info('Calling sendP2PKToken...');
        assertSenderAccountActive();
        const { token } = await sendP2PKToken(
          amountInSmallestUnits,
          recipientPubkey,
          {},
          async (step, total, message) => {
            logger.info('Progress update:', { step, total, message });
            setCurrentStep(step);
            setCurrentMessage(message);
            await updateProgress(step, message);
          },
          sendRecipient,
          cashuUnit
        );
        logger.info('sendP2PKToken completed successfully');

        // Step 5: Shortening URL
        setCurrentStep(5);
        setCurrentMessage('Shortening URL');
        await updateProgress(5, 'Shortening URL');

        // Generate shortened URL and save token to storage. This is critical:
        // sendP2PKToken has already spent local proofs, so the token must be
        // durable before showing success.
        const { generateTurboDeeplink, saveSentLockedToken } = await import(
          '../../services/cashu/cashuLockedTokensService'
        );
        const { clearRecoveredOutgoingSwapToken } = await import(
          '../../services/cashu/cashuSwapRecovery'
        );

        await saveSentLockedToken(
          token,
          sendRecipient,
          amountInSmallestUnits,
          null,
          null,
          senderTaprootAddress,
          cashuUnit
        );
        logger.info('Token saved to storage before URL shortening');

        const shortUrl = await generateTurboDeeplink(token, sendRecipient, amountInSmallestUnits);
        logger.info('Generated short URL', { shortUrlLength: shortUrl.length });

        await saveSentLockedToken(
          token,
          sendRecipient,
          amountInSmallestUnits,
          null,
          shortUrl,
          senderTaprootAddress,
          cashuUnit
        );
        try {
          await clearRecoveredOutgoingSwapToken(token);
        } catch (cleanupError) {
          logger.warn('TurboProcessing: outgoing token journal cleanup failed after durable save', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            cashuUnit,
          });
        }
        logger.info('Token saved to storage with short URL');

        // Clear timeout on success
        clearProcessingTimeout();

        // Mark processing as complete
        await completeProcessing();

        // Navigate to confirmation
        navigation.dispatch(
          StackActions.replace('Confirmation', {
            isTurbo: true,
            turboRecipient: sendRecipient,
            turboToken: token,
            turboAmount: amountInSmallestUnits,
            cashuUnit,
            skipMint: true,
          })
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to create Turbo token:', { error: errorMessage });

        // Clear timeout
        clearProcessingTimeout();

        const shouldPreserveProcessingState =
          errorMessage.includes('Cashu account changed during Turbo processing') ||
          errorMessage.includes('Wallet Taproot address unavailable for Turbo processing recovery');
        if (!shouldPreserveProcessingState) {
          // Mark processing as failed
          await failProcessing();
        }

        // Show error and go back
        Alert.alert('Error', `Failed to create token: ${errorMessage}`, [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    };

    createToken();

    // Cleanup timeout on unmount
    return () => {
      clearProcessingTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navigation,
    sendAmount,
    sendRecipient,
    cashuUnit,
    isBtcCashu,
    persistedStartedAt,
    senderTaprootAddress,
    wallet?.taprootAddress,
    startProcessing,
    updateProgress,
    completeProcessing,
    failProcessing,
  ]);

  return (
    <View style={localStyles.container} testID="turbo-processing-screen">
      <View style={localStyles.content}>
        <ActivityIndicator
          size="large"
          color={COLORS.PRIMARY_BLUE}
          style={localStyles.spinner}
          testID="turbo-processing-spinner"
        />
        <Text style={localStyles.title} testID="turbo-processing-title">
          Creating {isBtcCashu ? 'Turbo BTC' : 'Turbo UNIT'} Token
        </Text>
        <Text style={localStyles.message} testID="turbo-processing-message">
          {currentMessage}
        </Text>
        {totalSteps > 0 && (
          <Text style={localStyles.progress} testID="turbo-processing-progress">
            {currentStep} / {totalSteps}
          </Text>
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
  progress: {
    fontSize: 14,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
    marginTop: 12,
  },
});
