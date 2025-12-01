/**
 * RecipientHeader Component
 * Displays recipient address and address type in the amount input screen
 * With optional Turbo toggle for UNIT transactions
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface RecipientHeaderProps {
  onBackPress: () => void;
  recipientAddress: string;
  addressType: string;
  showTurboToggle?: boolean;
  turboEnabled?: boolean;
  onTurboToggle?: (value: boolean) => void;
}

export function RecipientHeader({
  onBackPress,
  recipientAddress,
  addressType,
  showTurboToggle = false,
  turboEnabled = false,
  onTurboToggle,
}: RecipientHeaderProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.header, { paddingTop: s(60), paddingHorizontal: s(20), paddingBottom: s(12) }]}>
      {/* Top row: Back button only */}
      <View style={[styles.topRow, { marginBottom: s(12) }]}>
        <TouchableOpacity onPress={onBackPress} style={[styles.backButton, { width: s(40), height: s(40) }]}>
          <Icon name="back" size={s(24)} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
      </View>

      {/* Recipient card */}
      <View style={[styles.recipientContainer, { borderRadius: s(12), paddingVertical: s(12), paddingHorizontal: s(16) }]}>
        <View style={styles.recipientLeft}>
          <Text style={[styles.recipientLabel, { fontSize: sf(14), marginRight: s(8) }]}>To:</Text>
          <Text style={[styles.recipientAddress, { fontSize: sf(14) }]}>
            {recipientAddress.substring(0, 8)}...
            {recipientAddress.substring(recipientAddress.length - 6)}
          </Text>
        </View>
        <View style={[styles.addressTypeTag, { paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: s(6) }]}>
          <Text style={[styles.addressTypeText, { fontSize: sf(11) }]}>{addressType}</Text>
        </View>
      </View>

      {/* Turbo toggle - below recipient card, aligned right */}
      {showTurboToggle && (
        <View style={[styles.turboRow, { marginTop: s(12) }]}>
          <TouchableOpacity
            style={styles.turboToggle}
            onPress={() => onTurboToggle?.(!turboEnabled)}
            activeOpacity={0.7}
          >
            <View style={styles.logoContainer}>
              <Icon name="unit_logo" size={s(24)} />
              {turboEnabled && (
                <Text style={[styles.turboEmoji, { fontSize: sf(12) }]}>{'\u26A1'}</Text>
              )}
            </View>
            <Switch
              value={turboEnabled}
              onValueChange={onTurboToggle}
              trackColor={{ false: COLORS.DARK_GRAY, true: COLORS.PRIMARY_BLUE + '60' }}
              thumbColor={turboEnabled ? COLORS.PRIMARY_BLUE : COLORS.MEDIUM_GRAY}
              ios_backgroundColor={COLORS.DARK_GRAY}
              style={[styles.turboSwitch, { marginLeft: s(8) }]}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'column',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  turboRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  turboToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
  },
  turboEmoji: {
    position: 'absolute',
    bottom: -4,
    right: -6,
  },
  turboSwitch: {
    marginLeft: 8,
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  recipientContainer: {
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
