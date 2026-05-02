/**
 * WalletHeader Component
 * Displays total balance and action buttons
 */

import React from 'react';
import { TextStyle,TouchableOpacity,View,ViewStyle } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

const HEADER_ICON_SIZE = 22;
const HEADER_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export interface WalletHeaderStyles {
  xverseHeader: ViewStyle;
  xverseHeaderLeft: ViewStyle;
  xverseAccountName: TextStyle;
  xverseHeaderRight: ViewStyle;
  headerIconButton: ViewStyle;
}

export interface WalletHeaderProps {
  accountNumber: number;
  onHistoryPress: () => void;
  onQRScanPress: () => void;
  onSettingsPress: () => void;
  styles: WalletHeaderStyles;
  testID?: string;
}

export default function WalletHeader({
  accountNumber,
  onHistoryPress,
  onQRScanPress,
  onSettingsPress,
  styles,
}: WalletHeaderProps) {
  return (
    <View style={styles.xverseHeader} accessibilityRole="header" accessibilityLabel={`Account ${accountNumber} wallet`}>
      <View style={styles.xverseHeaderLeft} />
      <View style={styles.xverseHeaderRight} accessibilityRole="toolbar" accessibilityLabel="Header actions">
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={onHistoryPress}
          testID="wallet-history-btn"
          accessibilityRole="button"
          accessibilityLabel="Transaction history"
          accessibilityHint="View your transaction history"
          hitSlop={HEADER_HIT_SLOP}
          pressRetentionOffset={HEADER_HIT_SLOP}
        >
          <Icon name="transaction_history" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={onQRScanPress}
          testID="wallet-scan-btn"
          accessibilityRole="button"
          accessibilityLabel="Scan QR code"
          accessibilityHint="Scan a QR code to send or receive"
          hitSlop={HEADER_HIT_SLOP}
          pressRetentionOffset={HEADER_HIT_SLOP}
        >
          <Icon name="qr_scan" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={onSettingsPress}
          testID="wallet-settings-btn"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Open app settings"
          hitSlop={HEADER_HIT_SLOP}
          pressRetentionOffset={HEADER_HIT_SLOP}
        >
          <Icon name="settings" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
