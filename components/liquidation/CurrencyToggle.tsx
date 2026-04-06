import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../styles/theme';

export interface CurrencyToggleProps {
  showBTC: boolean;
  onToggle: () => void;
}

const CurrencyToggle = React.memo(function CurrencyToggle({
  showBTC,
  onToggle,
}: CurrencyToggleProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.root}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={showBTC ? 'Show in USD' : 'Show in BTC'}
    >
      <View style={[styles.track, showBTC && styles.trackActive]}>
        <View style={[styles.thumb, showBTC && styles.thumbActive]}>
          <Text style={styles.activeText}>
            {showBTC ? '\u20BF' : '$'}
          </Text>
        </View>
        <Text style={[styles.label, showBTC ? styles.labelLeft : styles.labelRight]}>
          {showBTC ? '$' : '\u20BF'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  root: {
    padding: 4,
  },
  track: {
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.tertiary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  trackActive: {
    flexDirection: 'row-reverse',
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActive: {
    backgroundColor: colors.special.bitcoin,
  },
  activeText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
    position: 'absolute',
  },
  labelLeft: {
    left: 10,
  },
  labelRight: {
    right: 10,
  },
});

export default CurrencyToggle;
