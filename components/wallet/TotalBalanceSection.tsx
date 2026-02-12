/**
 * TotalBalanceSection Component
 * Displays total wallet balance with toggle between BTC and USD
 */

import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

// Constants
const BTC_ICON_SIZE = 12;
const LARGE_BALANCE_THRESHOLD = 10000000;

export interface TotalBalanceSectionStyles {
  xverseBalanceSection: ViewStyle;
  xverseBalanceLeft: ViewStyle;
  xverseBalanceLabel: TextStyle;
  balanceWithIcon: ViewStyle;
  balanceIcon: ViewStyle;
  xverseBalanceAmount: TextStyle;
}

export interface TotalBalanceSectionProps {
  showTotalInBTC: boolean;
  onToggle: () => void;
  totalBTC: string;
  totalUSD: string;
  totalBalanceUSD: number;
  styles: TotalBalanceSectionStyles;
  largeBalanceStyle?: ViewStyle | TextStyle;
  testID?: string;
}

export default memo(function TotalBalanceSection({
  showTotalInBTC,
  onToggle,
  totalBTC,
  totalUSD,
  totalBalanceUSD,
  styles,
  largeBalanceStyle,
  testID,
}: TotalBalanceSectionProps) {
  // Memoize the large balance style check
  const isLargeBalance = useMemo(
    () => totalBalanceUSD >= LARGE_BALANCE_THRESHOLD,
    [totalBalanceUSD]
  );

  return (
    <View style={styles.xverseBalanceSection} testID={testID} accessibilityRole="summary" accessibilityLabel="Total balance section">
      <View style={styles.xverseBalanceLeft}>
        <Text style={styles.xverseBalanceLabel} accessibilityElementsHidden>Total Balance USD</Text>
        <TouchableOpacity
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={showTotalInBTC ? `Total balance ${totalBTC} Bitcoin` : `Total balance $${totalUSD}`}
          accessibilityHint={showTotalInBTC ? "Tap to show balance in USD" : "Tap to show balance in Bitcoin"}
        >
          {showTotalInBTC ? (
            <View style={styles.balanceWithIcon} accessibilityElementsHidden>
              <Icon
                name="btc_symbol"
                size={BTC_ICON_SIZE}
                color={COLORS.VERY_LIGHT_GRAY}
                style={styles.balanceIcon}
              />
              <Text
                style={[
                  styles.xverseBalanceAmount,
                  isLargeBalance && largeBalanceStyle,
                ]}
              >
                {totalBTC}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.xverseBalanceAmount,
                isLargeBalance && largeBalanceStyle,
              ]}
              accessibilityElementsHidden
            >
              ${totalUSD}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});
