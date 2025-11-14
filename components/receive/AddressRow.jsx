/**
 * AddressRow Component
 * Displays a Bitcoin address with copy and QR code functionality
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function AddressRow({
  label,
  address,
  tag,
  tagStyle,
  onCopy,
  onQrPress,
  styles,
}) {
  return (
    <TouchableOpacity style={styles.receiveAddressRow} onPress={onCopy} activeOpacity={0.7}>
      <View style={styles.receiveAddressInfo}>
        <View style={styles.receiveAddressLabelRow}>
          <Text style={styles.receiveAddressLabel}>{label}</Text>
          <View style={[styles.receiveAddressTag, tagStyle.container]}>
            <Text style={[styles.receiveAddressTagText, tagStyle.text]}>{tag}</Text>
          </View>
        </View>
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

AddressRow.propTypes = {
  label: PropTypes.string.isRequired,
  address: PropTypes.string.isRequired,
  tag: PropTypes.string.isRequired,
  tagStyle: PropTypes.shape({
    container: PropTypes.object,
    text: PropTypes.object,
  }).isRequired,
  onCopy: PropTypes.func.isRequired,
  onQrPress: PropTypes.func.isRequired,
  styles: PropTypes.object.isRequired,
};
