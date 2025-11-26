/**
 * ReviewScreen - Full screen for reviewing transaction before signing
 * Shows recipient, amount, UTXOs, change, network, and fees
 */

import React, { useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { NavigationProp, RouteProp, CommonActions } from '@react-navigation/native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useReviewScreenData } from '../../hooks/useReviewScreenData';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useNavigationHandlers } from '../../contexts/NavigationHandlersContext';
import TransactionSummary from '../../components/review/TransactionSummary';
import FeeBreakdown from '../../components/review/FeeBreakdown';
import { InputOutputList } from '../../components/review/InputOutputList';
import UnconfirmedWarning from '../../components/review/UnconfirmedWarning';
import TurboWarning from '../../components/review/TurboWarning';

/**
 * Route parameters for ReviewScreen
 */
interface ReviewRouteParams {
  isTurbo?: boolean;
  mintQuoteId?: string;
  mintAmount?: number;
  turboRecipient?: string;
  cashuMint?: boolean;
  quoteId?: string;
}

/**
 * Props for ReviewScreen
 */
interface ReviewScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: ReviewRouteParams }, 'params'>;
}

export default function ReviewScreen({ navigation, route }: ReviewScreenProps): React.JSX.Element | null {
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

  const handleConfirm = () => {
    // Navigate to processing screen to sign and broadcast
    navigation.navigate('Processing', {
      fromScreen: 'Review',
      action: 'sign_and_broadcast',
      isTurbo,
      mintQuoteId,
      mintAmount,
      turboRecipient,
      cashuMint,
      quoteId,
    });
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
    <View style={localStyles.container} testID="review-screen">
      {/* Header with back button */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={handleBackPress} style={localStyles.backButton} testID="review-back-btn">
          <Icon name="back" size={20} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
        <Text style={localStyles.headerText}>You will send</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={localStyles.content}>
          {/* Transaction Summary */}
          <TransactionSummary
            recipient={(sendIntent.recipient as string) || ''}
            assetType={sendIntent.assetType || 'BTC'}
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
              sendIntent={{
                assetType: sendIntent.assetType || 'BTC',
                amount: typeof sendIntent.amount === 'number' ? sendIntent.amount.toString() : (sendIntent.amount || '0'),
                recipient: (sendIntent.recipient as string) || '',
              }}
              runeUtxoBalance={runeUtxoBalance ?? 0}
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
          testID="review-cancel-btn"
        >
          <Text style={localStyles.cancelButtonText}>Cancel</Text>
        </TouchableScale>

        <TouchableScale
          style={localStyles.confirmButton}
          onPress={handleConfirm}
          testID="review-confirm-btn"
        >
          <Text style={localStyles.confirmButtonText}>Confirm and Sign</Text>
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
});
