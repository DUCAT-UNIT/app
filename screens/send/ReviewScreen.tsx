/**
 * ReviewScreen - Full screen for reviewing transaction before signing
 * Shows recipient, amount, UTXOs, change, network, and fees
 */

import { CommonActions,NavigationProp,RouteProp,useIsFocused } from '@react-navigation/native';
import React,{ useEffect,useRef,useState } from 'react';
import { ActivityIndicator,ScrollView,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import FeeBreakdown from '../../components/review/FeeBreakdown';
import { InputOutputList } from '../../components/review/InputOutputList';
import TransactionSummary from '../../components/review/TransactionSummary';
import UnconfirmedWarning from '../../components/review/UnconfirmedWarning';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useReviewScreenData } from '../../hooks/useReviewScreenData';
import { analytics } from '../../services/analyticsService';
import { TRANSACTION_EVENTS } from '../../constants/analyticsEvents';
import { useSendFlowStore } from '../../stores/sendFlowStore';
import { COLORS } from '../../theme';

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
  const { s, sf } = useResponsive();
  const isTurbo = route?.params?.isTurbo === true;
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

  const selectedFeeRate = useSendFlowStore((state) => state.selectedFeeRate);
  const resetSendFlow = useSendFlowStore((state) => state.resetSendFlow);
  const { cancelIntent } = useTransactionBuild();
  const isFocused = useIsFocused();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const submitUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBusy = isSubmitting || isCancelling;

  // Track review screen viewed on mount
  useEffect(() => {
    if (sendIntent) {
      analytics.track(TRANSACTION_EVENTS.SEND_REVIEWED, {
        asset_type: sendIntent.assetType,
        amount: sendIntent.amount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle missing sendIntent - navigate back only when this screen is focused.
  // sendIntent gets cleared during broadcast (sign_and_broadcast phase), but ReviewScreen
  // is still mounted in the stack behind ProcessingScreen. Without the isFocused check,
  // this effect would call goBack() and disrupt navigation to ConfirmationScreen.
  useEffect(() => {
    if (!sendIntent && isFocused && !isCancelling) {
      navigation.goBack();
    }
  }, [sendIntent, navigation, isFocused, isCancelling]);

  useEffect(() => () => {
    if (submitUnlockTimerRef.current) {
      clearTimeout(submitUnlockTimerRef.current);
      submitUnlockTimerRef.current = null;
    }
  }, []);

  // Don't render if no sendIntent
  if (!sendIntent) {
    return null;
  }

  const handleConfirm = () => {
    if (isBusy) return;
    setIsSubmitting(true);
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
    if (submitUnlockTimerRef.current) {
      clearTimeout(submitUnlockTimerRef.current);
    }
    submitUnlockTimerRef.current = setTimeout(() => {
      submitUnlockTimerRef.current = null;
      setIsSubmitting(false);
    }, 1200);
    (submitUnlockTimerRef.current as { unref?: () => void }).unref?.();
  };

  const handleCancel = async () => {
    if (isBusy) return;
    setIsCancelling(true);
    // Release locked UTXOs before dismissing
    try {
      await cancelIntent();
    } finally {
      resetSendFlow();
      setIsCancelling(false);
    }

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
    if (isBusy) return;
    // For Turbo flow, there's no screen to go back to, so cancel instead
    if (isTurbo) {
      await handleCancel();
    } else {
      // Navigate back first, then cancel intent.
      // Order matters: goBack() before cancelIntent() prevents the
      // useEffect (!sendIntent && isFocused) from triggering a second goBack()
      // which would dismiss the entire modal stack.
      setIsCancelling(true);
      navigation.goBack();
      try {
        await cancelIntent();
      } finally {
        setIsCancelling(false);
      }
    }
  };

  return (
    <View style={localStyles.container} testID="review-screen">
      {/* Header with back button */}
      <View style={[localStyles.header, {
        paddingTop: s(60),
        paddingHorizontal: s(24),
        paddingBottom: s(20)
      }]}>
        <TouchableOpacity
          onPress={handleBackPress}
          disabled={isBusy}
          style={[localStyles.backButton, {
            padding: s(8),
            marginRight: s(12)
          }]}
          testID="review-back-btn"
        >
          <Icon name="back" size={s(20)} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
        <Text style={[localStyles.headerText, { fontSize: sf(18) }]}>You will send</Text>
      </View>

      <ScrollView style={localStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[localStyles.content, { paddingHorizontal: s(24) }]}>
          {/* Transaction Summary */}
          <TransactionSummary
            recipient={(sendIntent.recipient as string) || ''}
            assetType={sendIntent.assetType || 'BTC'}
            displayAmount={displayAmount}
            usdAmount={usdAmount}
          />

          {/* Unconfirmed Inputs Warning */}
          {hasUnconfirmedInputs && <UnconfirmedWarning />}

          {/* Fee Breakdown */}
          <FeeBreakdown actualFee={actualFee} feeRate={selectedFeeRate} />

          {/* Details Section - Collapsible */}
          <TouchableOpacity
            style={[localStyles.detailsHeaderCard, {
              borderRadius: s(12),
              padding: s(16),
              marginBottom: s(12)
            }]}
            onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={[localStyles.detailsHeaderText, { fontSize: sf(16) }]}>Transaction Details</Text>
            <Icon
              name={isDetailsExpanded ? 'chevron_up' : 'chevron_down'}
              size={s(20)}
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
      <View style={[localStyles.buttonContainer, {
        gap: s(12),
        paddingHorizontal: s(24),
        paddingTop: s(8),
        paddingBottom: s(20)
      }]}>
        <TouchableScale
          style={[localStyles.cancelButton, {
            paddingVertical: s(14),
            borderRadius: s(10)
          }]}
          onPress={handleCancel}
          disabled={isBusy}
          lockWhilePending
          pressLockMs={700}
          testID="review-cancel-btn"
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color={COLORS.VERY_LIGHT_GRAY} />
          ) : (
            <Text style={[localStyles.cancelButtonText, { fontSize: sf(15) }]}>Cancel</Text>
          )}
        </TouchableScale>

        <TouchableScale
          style={[localStyles.confirmButton, {
            paddingVertical: s(14),
            borderRadius: s(10)
          }]}
          onPress={handleConfirm}
          disabled={isBusy}
          pressLockMs={700}
          testID="review-confirm-btn"
        >
          {isSubmitting ? (
            <View style={localStyles.busyButtonContent}>
              <ActivityIndicator size="small" color={COLORS.VERY_LIGHT_GRAY} />
              <Text style={[localStyles.confirmButtonText, { fontSize: sf(15) }]}>Preparing...</Text>
            </View>
          ) : (
            <Text style={[localStyles.confirmButtonText, { fontSize: sf(15) }]}>Confirm and Sign</Text>
          )}
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
  },
  backButton: {
    // Dynamic padding and margin applied inline
  },
  headerText: {
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 0,
  },
  detailsHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE + '30',
  },
  detailsHeaderText: {
    fontWeight: '500',
    color: COLORS.PRIMARY_BLUE,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY_BLUE,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  busyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
