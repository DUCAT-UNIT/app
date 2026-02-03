/**
 * AssetCard Component
 * Displays individual asset balance information
 */

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';

// Constants
const CURRENCY_ICON_SIZE = 10;
const ASSET_LOGO_SIZE = 36;
const BTC_DECIMAL_PLACES = 8;
const USD_DECIMAL_PLACES = 2;

export interface AssetCardStyles {
  assetCard: ViewStyle;
  assetCardLast?: ViewStyle;
  assetRow: ViewStyle;
  assetLeft: ViewStyle;
  btcIcon: ViewStyle;
  ducatIcon?: ViewStyle;
  assetInfo: ViewStyle;
  assetName: TextStyle;
  balanceWithIcon: ViewStyle;
  assetAmountIcon: ViewStyle;
  assetAmount: TextStyle;
  assetValue: TextStyle;
  assetValueWithIcon: ViewStyle;
  assetIcon: ViewStyle;
}

export interface AssetCardProps {
  assetName: string;
  assetLogo: string;
  amountLabel?: string;
  amountValue: string | number;
  displayInBTC: boolean;
  btcValue: string | number;
  usdValue: string | number;
  styles: AssetCardStyles;
  isLast?: boolean;
  customAmountStyle?: ViewStyle | TextStyle;
  onPress?: () => void;
  testID?: string;
}

const AssetCard = React.memo(function AssetCard({
  assetName,
  assetLogo,
  amountLabel,
  amountValue,
  displayInBTC,
  btcValue,
  usdValue,
  styles,
  isLast,
  customAmountStyle,
  onPress,
  testID,
}: AssetCardProps) {
  const { s } = useResponsive();
  const CardWrapper = onPress ? TouchableOpacity : View;

  // Format accessibility label
  const formattedBtcValue = typeof btcValue === 'number' ? formatBalance(btcValue, BTC_DECIMAL_PLACES) : btcValue;
  const formattedUsdValue = typeof usdValue === 'number' ? formatFiat(usdValue, USD_DECIMAL_PLACES) : usdValue;
  const valueLabel = displayInBTC ? `${formattedBtcValue} Bitcoin` : `$${formattedUsdValue}`;

  return (
    <CardWrapper
      style={[styles.assetCard, isLast && styles.assetCardLast]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${assetName}: ${amountValue}, value ${valueLabel}`}
      accessibilityHint={onPress ? `View ${assetName} details` : undefined}
    >
      <View style={styles.assetRow} accessibilityElementsHidden>
        <View style={styles.assetLeft}>
          <View style={[styles.btcIcon, assetName !== 'Bitcoin' && styles.ducatIcon, { marginRight: s(9) }]}>
            <Icon name={assetLogo} size={ASSET_LOGO_SIZE} />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetName}>{assetName}</Text>
            <View style={styles.balanceWithIcon}>
              {amountLabel && (
                <Icon
                  name={amountLabel}
                  size={CURRENCY_ICON_SIZE}
                  color={COLORS.SECONDARY_TEXT}
                  style={styles.assetAmountIcon}
                />
              )}
              <Text style={[styles.assetAmount, customAmountStyle]}>
                {amountValue}
              </Text>
            </View>
          </View>
        </View>
        {displayInBTC ? (
          <View style={styles.assetValueWithIcon}>
            <Icon
              name="btc_symbol"
              size={CURRENCY_ICON_SIZE}
              color={COLORS.SECONDARY_TEXT}
              style={styles.assetIcon}
            />
            <Text style={styles.assetValue}>
              {formattedBtcValue}
            </Text>
          </View>
        ) : (
          <Text style={styles.assetValue}>
            ${' '}
            {formattedUsdValue}
          </Text>
        )}
      </View>
    </CardWrapper>
  );
});

export default AssetCard;
