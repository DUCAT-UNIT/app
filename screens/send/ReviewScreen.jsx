/**
 * ReviewScreen - Full screen for reviewing transaction before signing
 * Shows recipient, amount, UTXOs, change, network, and fees
 * Handles signing, broadcasting, and conversion inline with loading overlay
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useReviewScreenData } from '../../hooks/useReviewScreenData';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';
import TransactionSummary from '../../components/review/TransactionSummary';
import FeeBreakdown from '../../components/review/FeeBreakdown';
import InputOutputList from '../../components/review/InputOutputList';
import UnconfirmedWarning from '../../components/review/UnconfirmedWarning';
import TurboWarning from '../../components/review/TurboWarning';
import { logger } from '../../utils/logger';

export default function ReviewScreen({ navigation, route }) {
  const isTurbo = route?.params?.isTurbo === true;
  const { settingsHandlers } = useNavigationHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const mintQuoteId = route?.params?.mintQuoteId;
  const mintAmount = route?.params?.mintAmount;
  const turboRecipient = route?.params?.turboRecipient;
  const cashuMint = route?.params?.cashuMint === true;
  const quoteId = route?.params?.quoteId;
  const {
    sendIntent,
    btcPrice,
    isDetailsExpanded,
    setIsDetailsExpanded,
    runeUtxoBalance,
    hasUnconfirmedInputs,
    displayAmount,
    usdAmount,
    psbtInputs,
    outputs,
    actualFee,
  } = useReviewScreenData();

  const { cancelIntent } = useTransactionBuild();
  const { signIntent, broadcastedTxid } = useTransactionExecution();
  const { showSnackbar } = useNotifications();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashu();

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const hasStartedProcessing = useRef(false);

  // Handle missing sendIntent - navigate back in useEffect, not during render
  useEffect(() => {
    if (!sendIntent) {
      navigation.goBack();
    }
  }, [sendIntent, navigation]);

  // Don't render if no sendIntent
  if (!sendIntent) {
    return null;
  }

  // Complete mint process inline
  const completeMintInline = async (isTurbo, mintQuoteId, cashuQuoteId, mintAmount, turboRecipient) => {
    try {
      const { completeMint, sendP2PKToken } = await import('../../services/cashu/cashuWalletService');
      const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
      const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
      const { saveSentLockedToken, generateTurboDeeplink } = await import('../../services/cashu/cashuLockedTokensService');

      const quoteIdToUse = mintQuoteId || cashuQuoteId;
      logger.info('Starting mint completion in ReviewScreen', { quoteId: quoteIdToUse });
      setProcessingMessage('Waiting for payment confirmation...');

      // Poll for payment confirmation
      let paidQuote = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!paidQuote && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const quote = await checkMintQuote(quoteIdToUse);
        if (quote.state === 'PAID' || quote.state === 'ISSUED') {
          paidQuote = quote;
          break;
        }
        attempts++;
      }

      if (paidQuote) {
        logger.info('Payment confirmed! Completing mint...');
        setProcessingMessage('Converting to TurboUNIT...');

        // Complete mint to get e-cash tokens
        const proofs = await completeMint(quoteIdToUse, paidQuote.amount);
        logger.info('Mint completed', { proofCount: proofs.length });

        let turboToken = null;
        let turboDeeplink = null;

        // If Turbo with recipient, create P2PK locked token
        if (isTurbo && turboRecipient) {
          logger.info('🔑 Creating P2PK token:', {
            turboRecipient,
            amount: paidQuote.amount,
          });
          const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);
          const { token } = await sendP2PKToken(paidQuote.amount, recipientPubkey);
          turboToken = token;
          logger.info('P2PK token created successfully');

          // Generate short URL
          const shortUrl = await generateTurboDeeplink(token, turboRecipient, paidQuote.amount);
          turboDeeplink = shortUrl;

          // Save token to storage
          await saveSentLockedToken(token, turboRecipient, paidQuote.amount, broadcastedTxid, shortUrl, wallet.taprootAddress);
          logger.info('Turbo token created and saved');
        }

        // Refresh balance
        await refreshCashuBalance();
        logger.info('Cashu balance refreshed');

        // Show success and navigate to confirmation
        showSnackbar({ type: 'success', action: 'convert' });

        // Navigate to confirmation with token (skipMint mode)
        navigation.replace('Confirmation', {
          isTurbo,
          skipMint: true,
          turboToken,
          turboDeeplink,
        });
      } else {
        logger.warn('Payment not confirmed after 30 seconds');
        showSnackbar({ type: 'error', action: 'convert', description: 'Payment sent but conversion timed out' });
        navigation.replace('Confirmation', { isTurbo: false });
      }
    } catch (error) {
      logger.error('Failed to complete mint in ReviewScreen:', error);
      showSnackbar({ type: 'error', action: 'convert', description: `Failed: ${error.message}` });
      navigation.replace('Confirmation', { isTurbo: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (hasStartedProcessing.current || isProcessing) return;

    hasStartedProcessing.current = true;
    setIsProcessing(true);
    setProcessingMessage('Signing transaction...');

    try {
      // Sign and broadcast the transaction
      const success = await signIntent();

      if (success) {
        logger.debug('Broadcast successful, checking for mint flows:', {
          isTurbo,
          cashuMint,
          mintQuoteId,
        });

        // Check if this is a Turbo or Cashu mint flow
        if ((isTurbo || cashuMint) && (mintQuoteId || quoteId)) {
          setProcessingMessage('Broadcasting transaction...');

          // Small delay to show broadcasting message
          await new Promise(resolve => setTimeout(resolve, 500));

          // Complete mint process
          await completeMintInline(isTurbo, mintQuoteId, quoteId, mintAmount, turboRecipient);
        } else {
          // Regular transaction - navigate directly to confirmation
          setProcessingMessage('Transaction sent!');
          setTimeout(() => {
            navigation.replace('Confirmation', {
              isTurbo: false,
              cashuMint: false,
            });
          }, 500);
        }
      } else {
        throw new Error('Failed to sign and broadcast transaction');
      }
    } catch (error) {
      logger.error('Transaction error:', error);
      const errorMessage = error.message || error.toString() || 'Transaction failed';
      showSnackbar({ type: 'error', action: sendIntent.assetType === 'unit' ? 'swap' : 'withdraw', description: errorMessage });
      setIsProcessing(false);
      hasStartedProcessing.current = false;
    }
  };

  const handleCancel = async () => {
    // Release locked UTXOs before dismissing
    await cancelIntent();

    // Dismiss the send flow modal by navigating to Main
    // This works regardless of the modal stack depth
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      })
    );
  };

  const handleBackPress = async () => {
    // For Turbo flow, there's no screen to go back to, so cancel instead
    if (isTurbo) {
      await handleCancel();
    } else {
      // Just go back to amount screen - keep intent active
      navigation.goBack();
    }
  };

  return (
    <View style={localStyles.container}>
      {/* Header with back button */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={handleBackPress} style={localStyles.backButton}>
          <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
        <Text style={localStyles.headerText}>You will send</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          {/* Transaction Summary */}
          <TransactionSummary
            recipient={sendIntent.recipient}
            assetType={sendIntent.assetType}
            displayAmount={displayAmount}
            usdAmount={usdAmount}
          />

          {/* Turbo Warning - only show when Advanced Mode is enabled */}
          {isTurbo && advancedMode && <TurboWarning />}

          {/* Unconfirmed Inputs Warning */}
          {hasUnconfirmedInputs && <UnconfirmedWarning />}

          {/* Fee Breakdown */}
          <FeeBreakdown actualFee={actualFee} />

          {/* Details Section - Collapsible */}
          <TouchableOpacity
            style={localStyles.detailsHeaderCard}
            onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={localStyles.detailsHeaderText}>Transaction Details</Text>
            <Icon
              name={isDetailsExpanded ? 'chevron_up' : 'chevron_down'}
              size={20}
              color={COLORS.PRIMARY_BLUE}
            />
          </TouchableOpacity>

          {/* Input/Output List */}
          {isDetailsExpanded && (
            <InputOutputList
              psbtInputs={psbtInputs}
              outputs={outputs}
              sendIntent={sendIntent}
              runeUtxoBalance={runeUtxoBalance}
              btcPrice={btcPrice}
            />
          )}
        </View>
      </ScrollView>

      {/* Buttons - Fixed at bottom */}
      <View style={localStyles.buttonContainer}>
        <TouchableScale
          style={localStyles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={localStyles.cancelButtonText}>Cancel</Text>
        </TouchableScale>

        <TouchableScale
          style={localStyles.confirmButton}
          onPress={handleConfirm}
          disabled={isProcessing}
        >
          <Text style={localStyles.confirmButtonText}>Confirm and Sign</Text>
        </TouchableScale>
      </View>

      {/* Processing Overlay */}
      {isProcessing && (
        <View style={localStyles.processingOverlay}>
          <View style={localStyles.processingContent}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} />
            <Text style={localStyles.processingTitle}>
              {processingMessage.includes('Converting') ? 'Converting to TurboUNIT' : 'Sending Transaction'}
            </Text>
            <Text style={localStyles.processingMessage}>{processingMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  detailsHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  detailsHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    marginBottom: 24,
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  processingMessage: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
});
