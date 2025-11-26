/**
 * RecipientHeader Component
 * Displays recipient address and address type in the amount input screen
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

interface RecipientHeaderProps {
  onBackPress: () => void;
  recipientAddress: string;
  addressType: string;
}

export function RecipientHeader({ onBackPress, recipientAddress, addressType }: RecipientHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
        <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
      </TouchableOpacity>

      <View style={styles.recipientContainer}>
        <View style={styles.recipientLeft}>
          <Text style={styles.recipientLabel}>To:</Text>
          <Text style={styles.recipientAddress}>
            {recipientAddress.substring(0, 8)}...
            {recipientAddress.substring(recipientAddress.length - 6)}
          </Text>
        </View>
        <View style={styles.addressTypeTag}>
          <Text style={styles.addressTypeText}>{addressType}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
  },
  recipientContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  recipientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recipientLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginRight: 8,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  recipientAddress: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    flex: 1,
  },
  addressTypeTag: {
    backgroundColor: COLORS.DARK_GRAY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addressTypeText: {
    fontSize: 11,
    color: COLORS.LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
