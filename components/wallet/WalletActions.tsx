/* eslint-disable react-native/no-unused-styles */
/**
 * WalletActions Component
 * Renders vault actions plus separate wallet Send and Receive buttons.
 */

import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../../stores/notificationStore';
import { useResponsive } from '../../hooks/useResponsive';
import { COLORS } from '../../theme';

interface WalletActionsProps {
  isPendingVaultTx: boolean;
  isLowHealth: boolean;
  hasNoDebt: boolean;
  hasVault: boolean;
  hasVaultCollateral: boolean;
  onRepayPress: () => void;
  onBorrowPress: () => void;
  onWithdrawPress: () => void;
  onDepositPress: () => void;
  onSendPress: () => void;
  onReceivePress: () => void;
}

interface VaultActionButtonConfig {
  disabled: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  testID: string;
  disabledTestID: string;
  accessibilityLabel: string;
  accessibilityHint: string;
}

const WalletActions = React.memo(function WalletActions({
  isPendingVaultTx,
  isLowHealth,
  hasNoDebt,
  hasVault,
  hasVaultCollateral,
  onRepayPress,
  onBorrowPress,
  onWithdrawPress,
  onDepositPress,
  onSendPress,
  onReceivePress,
}: WalletActionsProps): React.ReactElement {
  const { s, sf } = useResponsive();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          width: '100%',
          paddingHorizontal: s(24),
          gap: s(12),
        },
        vaultGroup: {
          width: '100%',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: s(8),
          backgroundColor: 'rgba(255, 255, 255, 0.035)',
          paddingHorizontal: s(10),
          paddingTop: s(9),
          paddingBottom: s(8),
          gap: s(8),
        },
        vaultHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        vaultTitle: {
          color: COLORS.SECONDARY_TEXT,
          fontSize: sf(11),
          lineHeight: sf(14),
          fontWeight: '700',
          letterSpacing: 0,
          textTransform: 'uppercase',
        },
        vaultPendingLabel: {
          color: COLORS.YELLOW,
          fontSize: sf(11),
          lineHeight: sf(14),
          fontWeight: '700',
        },
        vaultActionsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: s(8),
        },
        walletRow: {
          flexDirection: 'row',
          gap: s(10),
        },
        stateSentinel: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
        },
        action: {
          flex: 1,
          alignItems: 'center',
          minWidth: 0,
          minHeight: s(62),
          justifyContent: 'center',
        },
        actionDisabled: {
          opacity: 0.5,
        },
        icon: {
          width: s(44),
          height: s(44),
          borderRadius: s(8),
          backgroundColor: '#DDDDDD',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: s(2),
        },
        iconDisabled: {
          backgroundColor: COLORS.DARK_GRAY,
        },
        iconGlyph: {
          color: COLORS.DARK_BG,
          fontSize: sf(24),
          lineHeight: sf(28),
          fontWeight: '200',
        },
        iconGlyphDisabled: {
          color: COLORS.SECONDARY_TEXT,
        },
        label: {
          fontSize: sf(12),
          lineHeight: sf(15),
          color: COLORS.WHITE,
          fontWeight: '600',
          textAlign: 'center',
        },
        labelDisabled: {
          color: COLORS.SECONDARY_TEXT,
        },
        walletAction: {
          flex: 1,
          minHeight: s(48),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(7),
          borderRadius: s(8),
          backgroundColor: COLORS.PRIMARY_BLUE,
          paddingHorizontal: s(12),
        },
        walletActionSecondary: {
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.14)',
          backgroundColor: COLORS.CARD_BG,
        },
        walletActionText: {
          color: COLORS.WHITE,
          fontSize: sf(15),
          lineHeight: sf(18),
          fontWeight: '700',
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

  const handleNoVaultPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No vault',
      description: 'Create a vault before using vault deposit or withdraw',
      type: 'warning',
    });
  }, []);

  const repayDisabled = isPendingVaultTx || hasNoDebt;
  const borrowDisabled = isPendingVaultTx || isLowHealth || !hasVaultCollateral;
  const withdrawDisabled = isPendingVaultTx || !hasVaultCollateral;
  const depositDisabled = isPendingVaultTx || !hasVault;
  const actionHitSlop = { top: 10, bottom: 10, left: 8, right: 8 };

  const vaultActions: VaultActionButtonConfig[] = [
    {
      disabled: repayDisabled,
      icon: '↓',
      label: 'Repay',
      onPress: isPendingVaultTx
        ? handleDisabledPress
        : hasNoDebt
          ? handleNoDebtPress
          : onRepayPress,
      testID: 'wallet-repay-btn',
      disabledTestID: 'wallet-repay-btn-disabled',
      accessibilityLabel: 'Repay vault debt',
      accessibilityHint: isPendingVaultTx
        ? 'Disabled while transaction is pending'
        : hasNoDebt
          ? 'No debt to repay'
          : 'Opens the repay screen',
    },
    {
      disabled: borrowDisabled,
      icon: '↑',
      label: 'Borrow',
      onPress: isPendingVaultTx
        ? handleDisabledPress
        : !hasVaultCollateral
          ? handleNoVaultCollateralPress
          : isLowHealth
            ? handleLowHealthPress
            : onBorrowPress,
      testID: 'wallet-borrow-btn',
      disabledTestID: 'wallet-borrow-btn-disabled',
      accessibilityLabel: 'Borrow against vault',
      accessibilityHint: isPendingVaultTx
        ? 'Disabled while transaction is pending'
        : !hasVaultCollateral
          ? 'No vault collateral to borrow against'
          : isLowHealth
            ? 'Vault health too low to borrow'
            : 'Opens the borrow screen',
    },
    {
      disabled: withdrawDisabled,
      icon: '−',
      label: 'Withdraw',
      onPress: isPendingVaultTx
        ? handleDisabledPress
        : !hasVaultCollateral
          ? handleNoVaultCollateralPress
          : onWithdrawPress,
      testID: 'wallet-withdraw-btn',
      disabledTestID: 'wallet-withdraw-btn-disabled',
      accessibilityLabel: 'Withdraw vault collateral',
      accessibilityHint: isPendingVaultTx
        ? 'Disabled while transaction is pending'
        : !hasVaultCollateral
          ? 'No vault collateral to withdraw'
          : 'Opens the vault withdraw screen',
    },
    {
      disabled: depositDisabled,
      icon: '+',
      label: 'Deposit',
      onPress: isPendingVaultTx
        ? handleDisabledPress
        : !hasVault
          ? handleNoVaultPress
          : onDepositPress,
      testID: 'wallet-deposit-btn',
      disabledTestID: 'wallet-deposit-btn-disabled',
      accessibilityLabel: 'Deposit vault collateral',
      accessibilityHint: isPendingVaultTx
        ? 'Disabled while transaction is pending'
        : !hasVault
          ? 'Create a vault before depositing collateral'
          : 'Opens the vault deposit screen',
    },
  ];

  const renderVaultAction = (action: VaultActionButtonConfig): React.ReactElement => (
    <TouchableOpacity
      key={action.label}
      style={[styles.action, action.disabled && styles.actionDisabled]}
      onPress={action.onPress}
      testID={action.disabled ? action.disabledTestID : action.testID}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityHint={action.accessibilityHint}
      accessibilityState={{ disabled: action.disabled }}
      hitSlop={actionHitSlop}
      pressRetentionOffset={actionHitSlop}
    >
      <View style={[styles.icon, action.disabled && styles.iconDisabled]}>
        {isPendingVaultTx && action.disabled ? (
          <ActivityIndicator color={COLORS.SECONDARY_TEXT} size="small" />
        ) : (
          <Text
            style={[styles.iconGlyph, action.disabled && styles.iconGlyphDisabled]}
            accessibilityElementsHidden
          >
            {action.icon}
          </Text>
        )}
      </View>
      <Text
        style={[styles.label, action.disabled && styles.labelDisabled]}
        accessibilityElementsHidden
      >
        {action.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={styles.row}
      testID="wallet-actions"
      accessibilityRole="toolbar"
      accessibilityLabel="Wallet actions"
    >
      <View
        pointerEvents="none"
        style={styles.stateSentinel}
        testID={isPendingVaultTx ? 'wallet-vault-actions-pending' : 'wallet-vault-actions-ready'}
      />
      <View style={styles.vaultGroup} testID="wallet-vault-action-group">
        <View style={styles.vaultHeader}>
          <Text style={styles.vaultTitle}>Vault</Text>
          {isPendingVaultTx && <Text style={styles.vaultPendingLabel}>Pending</Text>}
        </View>
        <View style={styles.vaultActionsRow}>{vaultActions.map(renderVaultAction)}</View>
      </View>

      <View style={styles.walletRow}>
        <TouchableOpacity
          style={styles.walletAction}
          onPress={onSendPress}
          testID="wallet-send-btn"
          accessibilityRole="button"
          accessibilityLabel="Send BTC or UNIT"
          accessibilityHint="Opens the send asset picker"
          hitSlop={actionHitSlop}
          pressRetentionOffset={actionHitSlop}
        >
          <Ionicons name="paper-plane-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.walletActionText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.walletAction, styles.walletActionSecondary]}
          onPress={onReceivePress}
          testID="wallet-receive-btn"
          accessibilityRole="button"
          accessibilityLabel="Receive BTC or UNIT"
          accessibilityHint="Opens the receive asset picker"
          hitSlop={actionHitSlop}
          pressRetentionOffset={actionHitSlop}
        >
          <Ionicons name="qr-code-outline" size={18} color={COLORS.WHITE} />
          <Text style={styles.walletActionText}>Receive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default WalletActions;
