/**
 * WalletActions Component
 * Renders the action buttons row (Repay, Borrow, Withdraw, Deposit) on the wallet screen
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNotificationStore } from '../../stores/notificationStore';
import { useResponsive } from '../../hooks/useResponsive';
import { COLORS } from '../../theme';

interface WalletActionsProps {
  isPendingVaultTx: boolean;
  isLowHealth: boolean;
  hasNoDebt: boolean;
  hasVaultCollateral: boolean;
  onRepayPress: () => void;
  onBorrowPress: () => void;
  onSendPress: () => void;
  onReceivePress: () => void;
}

const WalletActions = React.memo(function WalletActions({
  isPendingVaultTx,
  isLowHealth,
  hasNoDebt,
  hasVaultCollateral,
  onRepayPress,
  onBorrowPress,
  onSendPress,
  onReceivePress,
}: WalletActionsProps): React.ReactElement {
  const { s, sf } = useResponsive();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          marginLeft: s(24),
          gap: s(12),
        },
        action: {
          alignItems: 'center',
          minWidth: s(58),
          minHeight: s(66),
          justifyContent: 'center',
        },
        actionDisabled: {
          opacity: 0.5,
        },
        icon: {
          width: s(50),
          height: s(50),
          borderRadius: s(8),
          backgroundColor: '#DDDDDD',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: s(2),
        },
        iconDisabled: {
          backgroundColor: '#888888',
        },
        iconText: {
          fontSize: sf(24),
          color: COLORS.DARK_BG,
          fontWeight: '200',
        },
        label: {
          fontSize: sf(13),
          color: COLORS.WHITE,
          fontWeight: '600',
        },
        labelDisabled: {
          color: COLORS.SECONDARY_TEXT,
        },
      }),
    [s, sf]
  );

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
      description: 'You have no outstanding debt to repay',
      type: 'warning',
    });
  }, []);

  const handleNoVaultCollateralPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No collateral',
      description: 'Deposit BTC into your vault before borrowing',
      type: 'warning',
    });
  }, []);

  const repayDisabled = isPendingVaultTx || hasNoDebt;
  const borrowDisabled = isPendingVaultTx || isLowHealth || !hasVaultCollateral;
  const actionHitSlop = { top: 10, bottom: 10, left: 8, right: 8 };

  return (
    <View
      style={styles.row}
      testID="wallet-actions"
      accessibilityRole="toolbar"
      accessibilityLabel="Wallet actions"
    >
      <TouchableOpacity
        style={[styles.action, repayDisabled && styles.actionDisabled]}
        onPress={
          isPendingVaultTx ? handleDisabledPress : hasNoDebt ? handleNoDebtPress : onRepayPress
        }
        testID="wallet-repay-btn"
        accessibilityRole="button"
        accessibilityLabel="Repay vault debt"
        accessibilityHint={
          isPendingVaultTx
            ? 'Disabled while transaction is pending'
            : hasNoDebt
              ? 'No debt to repay'
              : 'Opens the repay screen'
        }
        accessibilityState={{ disabled: repayDisabled }}
        hitSlop={actionHitSlop}
        pressRetentionOffset={actionHitSlop}
      >
        <View style={[styles.icon, repayDisabled && styles.iconDisabled]}>
          <Text style={styles.iconText} accessibilityElementsHidden>
            ↓
          </Text>
        </View>
        <Text
          style={[styles.label, repayDisabled && styles.labelDisabled]}
          accessibilityElementsHidden
        >
          Repay
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.action, borrowDisabled && styles.actionDisabled]}
        onPress={
          isPendingVaultTx
            ? handleDisabledPress
            : !hasVaultCollateral
              ? handleNoVaultCollateralPress
              : isLowHealth
                ? handleLowHealthPress
                : onBorrowPress
        }
        testID="wallet-borrow-btn"
        accessibilityRole="button"
        accessibilityLabel="Borrow against vault"
        accessibilityHint={
          isPendingVaultTx
            ? 'Disabled while transaction is pending'
            : !hasVaultCollateral
              ? 'No vault collateral to borrow against'
              : isLowHealth
                ? 'Vault health too low to borrow'
                : 'Opens the borrow screen'
        }
        accessibilityState={{ disabled: borrowDisabled }}
        hitSlop={actionHitSlop}
        pressRetentionOffset={actionHitSlop}
      >
        <View style={[styles.icon, borrowDisabled && styles.iconDisabled]}>
          <Text style={styles.iconText} accessibilityElementsHidden>
            ↑
          </Text>
        </View>
        <Text
          style={[styles.label, borrowDisabled && styles.labelDisabled]}
          accessibilityElementsHidden
        >
          Borrow
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.action}
        onPress={onSendPress}
        testID="wallet-withdraw-btn"
        accessibilityRole="button"
        accessibilityLabel="Withdraw funds"
        accessibilityHint="Opens the send screen to withdraw BTC or UNIT"
        hitSlop={actionHitSlop}
        pressRetentionOffset={actionHitSlop}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText} accessibilityElementsHidden>
            -
          </Text>
        </View>
        <Text style={styles.label} accessibilityElementsHidden>
          Withdraw
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.action}
        onPress={onReceivePress}
        testID="wallet-deposit-btn"
        accessibilityRole="button"
        accessibilityLabel="Deposit funds"
        accessibilityHint="Opens the receive screen to deposit BTC or UNIT"
        hitSlop={actionHitSlop}
        pressRetentionOffset={actionHitSlop}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText} accessibilityElementsHidden>
            +
          </Text>
        </View>
        <Text style={styles.label} accessibilityElementsHidden>
          Deposit
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export default WalletActions;
