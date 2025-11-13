/**
 * AmountInputScreen - Full screen for entering send amount
 * Features: MAX button, USD conversion, dynamic font sizing
 */

import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../utils/colors';
import Icon from '../../components/Icon';
import { formatNumberWithCommas } from '../../utils/sendHelpers';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useWallet } from '../../contexts/WalletContext';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useKeyboard } from '../../hooks/useKeyboard';
import { calculateMaxSendableBTC } from '../../services/transactionCalculationService';

export default function AmountInputScreen({ navigation }) {
  const { sendAssetType, sendAmount, setSendAmount, sendRecipient, sendAddressType } = useSendFlow();
  const { segwitBalance, taprootBalance, runesBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { createSendIntent } = useTransactionBuild();
  const { keyboardHeight } = useKeyboard();
  const amountInputRef = useRef(null);
  const [isCalculatingMax, setIsCalculatingMax] = React.useState(false);

  // Calculate balance based on asset type
  const btcBalance = (segwitBalance || 0) + (taprootBalance || 0);
  const unitBalance =
    runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
  const balance = sendAssetType === 'btc' ? btcBalance : unitBalance;
  const assetLabel = sendAssetType === 'btc' ? 'BTC' : 'UNIT';

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

  const handleMaxPress = async () => {
    if (sendAssetType === 'btc') {
      setIsCalculatingMax(true);
      try {
        const sourceAddress = sendAddressType === 'taproot'
          ? wallet?.taprootAddress
          : wallet?.segwitAddress;

        const maxSendable = await calculateMaxSendableBTC({
          sourceAddress,
          btcBalance,
        });
        setSendAmount(String(maxSendable));
      } catch (error) {
        console.error('Error calculating max:', error);
        // Fallback to balance
        setSendAmount(String(balance || 0));
      } finally {
        setIsCalculatingMax(false);
      }
    } else {
      // For UNIT, just use full balance
      setSendAmount(String(balance || 0));
    }
  };

  const handleReview = () => {
    if (!sendAmount) return;

    amountInputRef.current?.blur();

    // Navigate to processing screen - the processing screen will handle creating the intent
    navigation.navigate('Processing', {
      fromScreen: 'AmountInput',
      action: 'create_intent'
    });
  };

  const usdValue =
    sendAmount && (sendAssetType === 'btc' ? btcPrice : 1)
      ? (parseFloat(sendAmount) * (sendAssetType === 'btc' ? btcPrice : 1)).toLocaleString(
          'en-US',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )
      : '0.00';

  return (
    <View style={localStyles.container}>
      {/* Header with back button and recipient info on same line */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backButton}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>

        <View style={localStyles.recipientContainer}>
          <View style={localStyles.recipientLeft}>
            <Text style={localStyles.recipientLabel}>To:</Text>
            <Text style={localStyles.recipientAddress}>
              {sendRecipient.substring(0, 8)}...
              {sendRecipient.substring(sendRecipient.length - 6)}
            </Text>
          </View>
          <View style={localStyles.addressTypeTag}>
            <Text style={localStyles.addressTypeText}>{addressType}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={localStyles.content}>
        {/* Balance and MAX button */}
        <View style={localStyles.balanceRow}>
          <Text style={localStyles.balanceLabel}>
            {assetLabel} Balance:{' '}
            {sendAssetType === 'btc'
              ? (balance || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 8,
                })
              : (balance || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
          </Text>
          <Pressable
            style={localStyles.maxButton}
            onPress={handleMaxPress}
            disabled={isCalculatingMax}
          >
            {isCalculatingMax ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
            ) : (
              <Text style={localStyles.maxButtonText}>MAX</Text>
            )}
          </Pressable>
        </View>

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
        <TouchableOpacity
          style={[
            localStyles.reviewButton,
            !sendAmount && localStyles.reviewButtonDisabled,
          ]}
          onPress={handleReview}
          disabled={!sendAmount}
          activeOpacity={0.7}
        >
          <Text style={localStyles.reviewButtonText}>Review</Text>
        </TouchableOpacity>
      </View>
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
  },
  recipientContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  recipientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recipientLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginRight: 8,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  recipientAddress: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    flex: 1,
  },
  addressTypeTag: {
    backgroundColor: COLORS.DARK_GRAY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addressTypeText: {
    fontSize: 11,
    color: COLORS.LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  maxButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
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
