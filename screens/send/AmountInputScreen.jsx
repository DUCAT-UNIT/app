/**
 * AmountInputScreen - Full screen for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { formatNumberWithCommas } from '../../utils/sendHelpers';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useAmountInput } from '../../hooks/useAmountInput';
import { RecipientHeader, BalanceMaxButton } from '../../components/amountInput';
import { requestMint } from '../../services/cashu/cashuWalletService';
import { useCashu } from '../../contexts/CashuContext';

export default function AmountInputScreen({ navigation, route }) {
  const { sendAssetType, sendAmount, setSendAmount, sendRecipient, sendAddressType, spectreEnabled, setSendRecipient: setRecipient } = useSendFlow();
  const [isRequestingMint, setIsRequestingMint] = useState(false);
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashu();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { createSendIntent: _createSendIntent } = useTransactionBuild();
  const { keyboardHeight } = useKeyboard();
  const amountInputRef = useRef(null);

  // Check if this is a Cashu mint transaction
  const isCashuMint = route?.params?.cashuMint === true;
  const cashuQuoteId = route?.params?.quoteId;

  // Use amount input hook for balance calculations and MAX functionality
  const { balance, assetLabel, isCalculatingMax, handleMaxPress, calculateUsdValue } = useAmountInput({
    sendAssetType,
    segwitBalance,
    taprootBalance,
    runesBalance,
    cashuBalance,
    wallet,
    sendAddressType,
    setSendAmount,
  });

  // Determine address type from recipient
  const addressType =
    sendRecipient.startsWith('tb1p') || sendRecipient.startsWith('bc1p')
      ? 'Taproot'
      : 'Native SegWit';

  useEffect(() => {
    // Auto-focus input when screen loads
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle prefilled amount and auto-advance (for non-Spectre flows)
  useEffect(() => {
    const { prefillAmount, autoAdvance } = route.params || {};

    if (prefillAmount && !sendAmount) {
      setSendAmount(prefillAmount.toString());

      // If autoAdvance is true, automatically proceed to review
      if (autoAdvance) {
        // Small delay to ensure amount is set
        setTimeout(() => {
          amountInputRef.current?.blur();
          navigation.navigate('Processing', {
            fromScreen: 'AmountInput',
            action: 'create_intent',
          });
        }, 500);
      }
    }
  }, [route.params?.prefillAmount, route.params?.autoAdvance]);

  const handleAmountChange = (text) => {
    // Handle decimal comma from keyboard
    let processed = text;

    // If text ends with a comma and there's no period yet, it's a decimal comma
    if (processed.endsWith(',') && !processed.includes('.')) {
      // Replace the last comma with a period
      processed = processed.slice(0, -1) + '.';
    }

    // Remove all remaining commas (thousand separators)
    const cleaned = processed.replace(/,/g, '');

    // Only allow numbers and one decimal point
    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      setSendAmount(cleaned);
    }
  };

  const handleReview = async () => {
    if (!sendAmount || isRequestingMint) return;

    amountInputRef.current?.blur();

    // If Spectre mode is enabled for UNIT transfers, check if we have enough ecash first
    if (spectreEnabled && sendAssetType === 'unit') {
      try {
        setIsRequestingMint(true);

        // Use display amount directly (e.g., "100" for 100 UNIT)
        const displayAmount = parseFloat(sendAmount);
        const amountInSmallestUnits = Math.round(displayAmount * 100);

        // Check current ecash balance
        const { getBalance } = await import('../../services/cashu/cashuWalletService');
        const ecashBalance = await getBalance();
        const ecashBalanceSmallestUnits = Math.round(ecashBalance * 100);

        console.log('[AmountInputScreen] Spectre mode - checking balance:', {
          requested: displayAmount,
          ecashBalance,
          hasEnough: ecashBalanceSmallestUnits >= amountInSmallestUnits,
        });

        // If we have enough ecash, skip minting and create P2PK token directly
        if (ecashBalanceSmallestUnits >= amountInSmallestUnits) {
          console.log('[AmountInputScreen] ✅ Sufficient ecash balance - skipping mint, creating P2PK token directly');

          const { sendP2PKToken } = await import('../../services/cashu/cashuWalletService');
          const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');

          // Extract recipient's pubkey
          const recipientPubkey = extractPubkeyFromTaprootAddress(sendRecipient);

          // Create P2PK locked token
          const { token } = await sendP2PKToken(amountInSmallestUnits, recipientPubkey);

          // Save token to storage
          try {
            const { saveSentLockedToken } = await import('../../services/cashu/cashuLockedTokensService');
            await saveSentLockedToken(token, sendRecipient, amountInSmallestUnits, null);
            console.log('[AmountInputScreen] Token saved to storage');
          } catch (storageError) {
            console.error('[AmountInputScreen] Failed to save token:', storageError);
            // Non-critical - continue anyway
          }

          setIsRequestingMint(false);

          // Navigate directly to confirmation with the token (no on-chain tx needed)
          navigation.navigate('Confirmation', {
            isSpectre: true,
            spectreRecipient: sendRecipient,
            spectreToken: token,
            spectreAmount: amountInSmallestUnits,
            skipMint: true, // Flag to indicate we skipped the mint
          });

          return;
        }

        // Not enough ecash - proceed with normal mint flow
        console.log('[AmountInputScreen] ⚠️ Insufficient ecash balance - proceeding with mint flow');
        console.log('[AmountInputScreen] Requesting mint quote for amount:', displayAmount);

        // Request mint quote from Cashu mint
        const mintQuote = await requestMint(displayAmount);

        console.log('[AmountInputScreen] Received mint quote:', {
          quoteId: mintQuote.quoteId,
          amount: mintQuote.amount,
          depositAddress: mintQuote.depositAddress,
        });

        // Store the original recipient address (where tokens will be locked)
        const originalRecipient = sendRecipient;

        // Temporarily update recipient to mint's deposit address
        setRecipient(mintQuote.depositAddress);

        console.log('[AmountInputScreen] Navigating to Processing with params:', {
          isSpectre: true,
          mintQuoteId: mintQuote.quoteId,
          mintAmount: mintQuote.amount, // Use amount from quote, not displayAmount
          spectreRecipient: originalRecipient,
        });

        // Navigate to processing screen with Spectre params
        navigation.navigate('Processing', {
          fromScreen: 'AmountInput',
          action: 'create_intent',
          isSpectre: true,
          mintQuoteId: mintQuote.quoteId,
          mintAmount: mintQuote.amount, // IMPORTANT: Use quote amount (in smallest units)
          spectreRecipient: originalRecipient, // Original address for P2PK locking
        });
      } catch (error) {
        console.error('Failed to request mint quote:', error);
        Alert.alert('Error', 'Failed to initiate Spectre transaction. Please try again.');
      } finally {
        setIsRequestingMint(false);
      }
    } else {
      // Normal flow - Navigate to processing screen
      // Pass along Cashu mint params if this is a Cashu mint transaction
      navigation.navigate('Processing', {
        fromScreen: 'AmountInput',
        action: 'create_intent',
        cashuMint: isCashuMint,
        quoteId: cashuQuoteId,
      });
    }
  };

  const usdValue = calculateUsdValue(sendAmount, btcPrice);

  // Check if user has sufficient balance
  // For UNIT, check total balance (on-chain + ecash)
  const hasNoUnitBalance = sendAssetType === 'unit' && balance === 0;

  // Check if amount exceeds available balance
  const enteredAmount = parseFloat(sendAmount) || 0;
  const exceedsBalance = sendAmount && enteredAmount > balance;

  // Determine if we should show insufficient balance warning
  const hasInsufficientBalance = hasNoUnitBalance || exceedsBalance;
  const isReviewDisabled = !sendAmount || hasInsufficientBalance || isRequestingMint;

  return (
    <View style={localStyles.container}>
      {/* Header with back button and recipient info */}
      <RecipientHeader
        onBackPress={() => navigation.goBack()}
        recipientAddress={sendRecipient}
        addressType={addressType}
      />

      {/* Content */}
      <View style={localStyles.content}>
        {/* Balance and MAX button */}
        <BalanceMaxButton
          assetLabel={assetLabel}
          balance={balance}
          assetType={sendAssetType}
          onMaxPress={handleMaxPress}
          isCalculating={isCalculatingMax}
        />

        {/* Insufficient balance warning */}
        {hasInsufficientBalance && (
          <View style={localStyles.warningContainer}>
            <Icon name="warning" size={16} color={COLORS.DANGER_RED} />
            <Text style={localStyles.warningText}>
              {hasNoUnitBalance
                ? 'No available UNIT balance to send'
                : 'Insufficient balance'}
            </Text>
          </View>
        )}

        {/* Amount input */}
        <View style={localStyles.amountInputRow}>
          <TextInput
            ref={amountInputRef}
            style={[
              localStyles.amountInput,
              formatNumberWithCommas(sendAmount).length > 8 && localStyles.mediumText,
              formatNumberWithCommas(sendAmount).length > 12 && localStyles.smallText,
              formatNumberWithCommas(sendAmount).length > 15 && localStyles.xsmallText,
            ]}
            value={formatNumberWithCommas(sendAmount)}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={COLORS.MID_DARK_GRAY}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleReview}
          />
          <Icon
            name={sendAssetType === 'btc' ? 'btc_symbol' : 'unit_symbol'}
            size={32}
            color={COLORS.VERY_LIGHT_GRAY}
          />
        </View>

        {/* USD conversion */}
        <Text style={localStyles.usdValue}>≈ ${usdValue} USD</Text>
      </View>

      {/* Review Button - Sits on top of keyboard */}
      <View style={[localStyles.buttonContainer, { bottom: keyboardHeight }]}>
        <TouchableScale
          style={[
            localStyles.reviewButton,
            isReviewDisabled && localStyles.reviewButtonDisabled,
          ]}
          onPress={handleReview}
          disabled={isReviewDisabled}
        >
          <Text style={localStyles.reviewButtonText}>Review</Text>
        </TouchableScale>
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
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.DANGER_RED,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  amountInput: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'right',
    marginRight: 12,
    minWidth: 60,
  },
  mediumText: {
    fontSize: 44,
  },
  smallText: {
    fontSize: 36,
  },
  xsmallText: {
    fontSize: 28,
  },
  usdValue: {
    fontSize: 18,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    fontFamily: 'CabinetGrotesk-Regular',
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.DARK_BG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_COLOR,
  },
  reviewButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonDisabled: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    opacity: 0.5,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
