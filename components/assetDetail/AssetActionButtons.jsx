/**
 * AssetActionButtons Component
 * Send and Receive action buttons for assets
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

export function AssetActionButtons({ onSendPress, onReceivePress }) {
  return (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onSendPress}
      >
        <View style={styles.actionButtonIcon}>
          <Icon name="send" size={19} color={COLORS.WHITE} />
        </View>
        <Text style={styles.actionButtonLabel}>Send</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onReceivePress}
      >
        <View style={styles.actionButtonIcon}>
          <Icon name="receive" size={19} color={COLORS.WHITE} />
        </View>
        <Text style={styles.actionButtonLabel}>Receive</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 62,
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1.2,
    borderColor: COLORS.BORDER_COLOR,
  },
  actionButtonLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
});
