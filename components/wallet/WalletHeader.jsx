/**
 * WalletHeader Component
 * Displays account name and action buttons
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

const HEADER_ICON_SIZE = 22;

export default function WalletHeader({
  accountNumber,
  onHistoryPress,
  onQRScanPress,
  onSettingsPress,
  styles,
}) {
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

WalletHeader.propTypes = {
  accountNumber: PropTypes.number.isRequired,
  onHistoryPress: PropTypes.func.isRequired,
  onQRScanPress: PropTypes.func.isRequired,
  onSettingsPress: PropTypes.func.isRequired,
  styles: PropTypes.object.isRequired,
};
