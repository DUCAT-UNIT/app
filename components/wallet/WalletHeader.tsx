/**
 * WalletHeader Component
 * Displays total balance and action buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

const HEADER_ICON_SIZE = 22;

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
        >
          <Icon name="transaction_history" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={onQRScanPress}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code"
          accessibilityHint="Scan a QR code to send or receive"
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
        >
          <Icon name="settings" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
