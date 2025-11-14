/**
 * TotalBalanceSection Component
 * Displays total wallet balance with toggle between BTC and USD
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

// Constants
const BTC_ICON_SIZE = 12;
const LARGE_BALANCE_THRESHOLD = 10000000;

export default function TotalBalanceSection({
  showTotalInBTC,
  onToggle,
  totalBTC,
  totalUSD,
  totalBalanceUSD,
  styles,
  largeBalanceStyle,
}) {
  return (
    <View style={styles.xverseBalanceSection}>
      <View style={styles.xverseBalanceLeft}>
        <Text style={styles.xverseBalanceLabel}>Total Balance USD</Text>
        <TouchableOpacity onPress={onToggle}>
          {showTotalInBTC ? (
            <View style={styles.balanceWithIcon}>
              <Icon
                name="btc_symbol"
                size={BTC_ICON_SIZE}
                color={COLORS.VERY_LIGHT_GRAY}
                style={styles.balanceIcon}
              />
              <Text style={styles.xverseBalanceAmount}>{totalBTC}</Text>
            </View>
          ) : (
            <Text
              style={[
                styles.xverseBalanceAmount,
                totalBalanceUSD >= LARGE_BALANCE_THRESHOLD && largeBalanceStyle,
              ]}
            >
              ${totalUSD}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

TotalBalanceSection.propTypes = {
  showTotalInBTC: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  totalBTC: PropTypes.string.isRequired,
  totalUSD: PropTypes.string.isRequired,
  totalBalanceUSD: PropTypes.number.isRequired,
  styles: PropTypes.object.isRequired,
  largeBalanceStyle: PropTypes.object,
};
