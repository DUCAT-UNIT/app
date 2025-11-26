/**
 * WalletHeader Component
 * Displays account name and action buttons
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
    <View style={styles.xverseHeader}>
      <View style={styles.xverseHeaderLeft}>
        <Text style={styles.xverseAccountName}>Account {accountNumber}</Text>
      </View>
      <View style={styles.xverseHeaderRight}>
        <TouchableOpacity style={styles.headerIconButton} onPress={onHistoryPress}>
          <Icon name="transaction_history" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconButton} onPress={onQRScanPress}>
          <Icon name="qr_scan" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconButton} onPress={onSettingsPress}>
          <Icon name="settings" size={HEADER_ICON_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
