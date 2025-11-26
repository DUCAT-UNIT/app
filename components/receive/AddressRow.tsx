/**
 * AddressRow Component
 * Displays a Bitcoin address with copy and QR code functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

interface AddressRowProps {
  label: string;
  address: string;
  tag: string;
  onCopy: () => void;
  onQrPress: () => void;
  styles: {
    receiveAddressRow: ViewStyle;
    receiveAddressInfo: ViewStyle;
    receiveAddressLabel: TextStyle;
    receiveAddress: TextStyle;
    receiveQrButton: ViewStyle;
  };
}

export default function AddressRow({
  label,
  address,
  tag,
  onCopy,
  onQrPress,
  styles,
}: AddressRowProps) {
  // Determine which logo to show based on tag
  const logoName = tag === 'BTC' ? 'btc_logo' : 'unit_logo';

  return (
    <TouchableOpacity style={styles.receiveAddressRow} onPress={onCopy} activeOpacity={0.7}>
      <View style={localStyles.logoContainer}>
        <Icon name={logoName} size={32} />
      </View>
      <View style={styles.receiveAddressInfo}>
        <Text style={styles.receiveAddressLabel}>{label}</Text>
        <Text style={styles.receiveAddress} numberOfLines={1} ellipsizeMode="middle">
          {address}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.receiveQrButton}
        onPress={(e) => {
          e.stopPropagation();
          onQrPress();
        }}
      >
        <Icon name="qr_code" size={24} color={COLORS.PRIMARY_BLUE} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const localStyles = StyleSheet.create({
  logoContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

