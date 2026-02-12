/**
 * WalletActions Component
 * Renders the action buttons row (Repay, Borrow, Withdraw, Deposit) on the wallet screen
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNotificationStore } from '../../stores/notificationStore';
import { useResponsive } from '../../hooks/useResponsive';
import { COLORS } from '../../theme';

interface WalletActionsProps {
  isPendingVaultTx: boolean;
  isLowHealth: boolean;
  hasNoDebt: boolean;
  hasInsufficientFunds: boolean;
  onRepayPress: () => void;
  onBorrowPress: () => void;
  onSendPress: () => void;
  onReceivePress: () => void;
}

const WalletActions = React.memo(function WalletActions({
  isPendingVaultTx,
  isLowHealth,
  hasNoDebt,
  hasInsufficientFunds,
  onRepayPress,
  onBorrowPress,
  onSendPress,
  onReceivePress,
}: WalletActionsProps): React.ReactElement {
  const { s, sf } = useResponsive();

  const handleDisabledPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Transaction pending',
      description: 'Please wait for the current vault transaction to confirm',
      type: 'warning',
    });
  }, []);

  const handleLowHealthPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Health too low',
      description: 'Vault health must be above 160% to withdraw or borrow',
      type: 'warning',
    });
  }, []);

  const handleNoDebtPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No debt',
      description: 'You have no UNIT debt to repay or borrow against',
      type: 'warning',
    });
  }, []);

  const handleInsufficientFundsPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No funds available',
      description: 'You need BTC or UNIT in your wallet to send',
      type: 'warning',
    });
  }, []);

  const repayDisabled = isPendingVaultTx || hasNoDebt;
  const borrowDisabled = isPendingVaultTx || isLowHealth || hasNoDebt;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginLeft: s(24), gap: s(12) }} testID="wallet-actions" accessibilityRole="toolbar" accessibilityLabel="Wallet actions">
      <TouchableOpacity
        style={{ alignItems: 'center', opacity: repayDisabled ? 0.5 : 1 }}
        onPress={isPendingVaultTx ? handleDisabledPress : hasNoDebt ? handleNoDebtPress : onRepayPress}
        testID="wallet-repay-btn"
        accessibilityRole="button"
        accessibilityLabel="Repay UNIT debt"
        accessibilityHint={isPendingVaultTx ? "Disabled while transaction is pending" : hasNoDebt ? "No debt to repay" : "Opens the repay screen"}
        accessibilityState={{ disabled: repayDisabled }}
      >
        <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: repayDisabled ? '#888888' : '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
          <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }} accessibilityElementsHidden>↓</Text>
        </View>
        <Text style={{ fontSize: sf(13), color: repayDisabled ? COLORS.SECONDARY_TEXT : COLORS.WHITE, fontWeight: '600' }} accessibilityElementsHidden>Repay</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ alignItems: 'center', opacity: borrowDisabled ? 0.5 : 1 }}
        onPress={isPendingVaultTx ? handleDisabledPress : hasNoDebt ? handleNoDebtPress : isLowHealth ? handleLowHealthPress : onBorrowPress}
        testID="wallet-borrow-btn"
        accessibilityRole="button"
        accessibilityLabel="Borrow UNIT"
        accessibilityHint={isPendingVaultTx ? "Disabled while transaction is pending" : hasNoDebt ? "No vault to borrow from" : isLowHealth ? "Vault health too low to borrow" : "Opens the borrow screen"}
        accessibilityState={{ disabled: borrowDisabled }}
      >
        <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: borrowDisabled ? '#888888' : '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
          <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }} accessibilityElementsHidden>↑</Text>
        </View>
        <Text style={{ fontSize: sf(13), color: borrowDisabled ? COLORS.SECONDARY_TEXT : COLORS.WHITE, fontWeight: '600' }} accessibilityElementsHidden>Borrow</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ alignItems: 'center', opacity: hasInsufficientFunds ? 0.5 : 1 }}
        onPress={hasInsufficientFunds ? handleInsufficientFundsPress : onSendPress}
        testID="wallet-withdraw-btn"
        accessibilityRole="button"
        accessibilityLabel="Withdraw funds"
        accessibilityHint={hasInsufficientFunds ? "No funds available to withdraw" : "Opens the send screen to withdraw BTC or UNIT"}
        accessibilityState={{ disabled: hasInsufficientFunds }}
      >
        <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: hasInsufficientFunds ? '#888888' : '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
          <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }} accessibilityElementsHidden>-</Text>
        </View>
        <Text style={{ fontSize: sf(13), color: hasInsufficientFunds ? COLORS.SECONDARY_TEXT : COLORS.WHITE, fontWeight: '600' }} accessibilityElementsHidden>Withdraw</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ alignItems: 'center' }}
        onPress={onReceivePress}
        testID="wallet-deposit-btn"
        accessibilityRole="button"
        accessibilityLabel="Deposit funds"
        accessibilityHint="Opens the receive screen to deposit BTC or UNIT"
      >
        <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
          <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }} accessibilityElementsHidden>+</Text>
        </View>
        <Text style={{ fontSize: sf(13), color: COLORS.WHITE, fontWeight: '600' }} accessibilityElementsHidden>Deposit</Text>
      </TouchableOpacity>
    </View>
  );
});

export default WalletActions;
