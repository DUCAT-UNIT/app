/**
 * AssetCard Component
 * Displays individual asset balance information
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';

// Constants
const CURRENCY_ICON_SIZE = 10;
const ASSET_LOGO_SIZE = 36;
const BTC_DECIMAL_PLACES = 8;
const USD_DECIMAL_PLACES = 2;

export default function AssetCard({
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
}) {
  return (
    <View style={[styles.assetCard, isLast && styles.assetCardLast]}>
      <View style={styles.assetRow}>
        <View style={styles.assetLeft}>
          <View style={[styles.btcIcon, assetName !== 'Bitcoin' && styles.ducatIcon]}>
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
              {typeof btcValue === 'number'
                ? btcValue.toLocaleString('en-US', {
                    minimumFractionDigits: BTC_DECIMAL_PLACES,
                    maximumFractionDigits: BTC_DECIMAL_PLACES,
                  })
                : btcValue}
            </Text>
          </View>
        ) : (
          <Text style={styles.assetValue}>
            ${' '}
            {typeof usdValue === 'number'
              ? usdValue.toLocaleString('en-US', {
                  minimumFractionDigits: USD_DECIMAL_PLACES,
                  maximumFractionDigits: USD_DECIMAL_PLACES,
                })
              : usdValue}
          </Text>
        )}
      </View>
    </View>
  );
}

AssetCard.propTypes = {
  assetName: PropTypes.string.isRequired,
  assetLogo: PropTypes.string.isRequired,
  amountLabel: PropTypes.string,
  amountValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  displayInBTC: PropTypes.bool.isRequired,
  btcValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  usdValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  styles: PropTypes.object.isRequired,
  isLast: PropTypes.bool,
  customAmountStyle: PropTypes.object,
};
