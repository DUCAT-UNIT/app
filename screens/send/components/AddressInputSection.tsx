/**
 * AddressInputSection Component
 * Address input with validation status, paste, and QR scan buttons
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing, radii } from '../../../styles/theme';
import type { AssetType } from '../../../stores/sendFlowStore';
import { MUTINYNET_NETWORK } from '../../../utils/bitcoin';

interface AddressInputSectionProps {
  /** Current recipient address */
  value: string;
  /** Asset type (btc or unit) */
  assetType: AssetType;
  /** Address error message */
  addressError: string;
  /** Whether address is valid */
  isValidAddress: boolean;
  /** Called when address changes */
  onChangeText: (text: string) => void;
  /** Called when paste button pressed */
  onPaste: () => void;
  /** Called when QR scan button pressed */
  onScanQR: () => void;
}

export function AddressInputSection({
  value,
  assetType,
  addressError,
  isValidAddress,
  onChangeText,
  onPaste,
  onScanQR,
}: AddressInputSectionProps): React.JSX.Element {
  const addressInputRef = useRef<TextInput>(null);
  const bech32Hrp = typeof MUTINYNET_NETWORK?.bech32 === 'string' ? MUTINYNET_NETWORK.bech32 : 'tb';
  const taprootPrefix = `${bech32Hrp}1p`;
  const segwitPrefix = `${bech32Hrp}1q`;

  const placeholder = assetType === 'unit'
    ? `${taprootPrefix}...`
    : `${segwitPrefix}... or ${taprootPrefix}...`;

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Recipient Address</Text>
        {addressError ? (
          <View style={styles.statusRow}>
            <Ionicons name="close-circle" size={14} color={colors.semantic.error} />
            <Text style={styles.statusTextError}>Invalid</Text>
          </View>
        ) : isValidAddress ? (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.semantic.success} />
            <Text style={styles.statusTextSuccess}>Valid</Text>
          </View>
        ) : null}
      </View>

      {addressError && (
        <Text style={styles.errorText}>{addressError}</Text>
      )}

      <View style={styles.addressContainer}>
        <TextInput
          ref={addressInputRef}
          style={styles.addressInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={2}
          testID="send-address-input"
          accessibilityLabel="Recipient Bitcoin address"
          accessibilityHint="Enter the Bitcoin address to send to"
        />
        <View style={styles.addressIcons}>
          <Pressable
            style={styles.addressIconBtn}
            onPress={onPaste}
            hitSlop={8}
            testID="send-paste-btn"
            accessibilityLabel="Paste address"
            accessibilityRole="button"
          >
            <Ionicons name="clipboard-outline" size={20} color={colors.text.tertiary} />
          </Pressable>
          <Pressable
            style={styles.addressIconBtn}
            onPress={onScanQR}
            hitSlop={8}
            testID="send-scan-btn"
            accessibilityLabel="Scan QR code"
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={20} color={colors.text.tertiary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusTextError: {
    color: colors.semantic.error,
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  statusTextSuccess: {
    color: colors.semantic.success,
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    marginBottom: spacing.sm,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressInput: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    fontFamily: fonts.regular,
    minHeight: 52,
    lineHeight: 22,
    paddingRight: spacing.sm,
  },
  addressIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressIconBtn: {
    padding: spacing.xs,
  },
});
