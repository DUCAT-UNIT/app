/**
 * VaultHealthGauge Component
 * Displays a semicircular gauge showing vault health status
 * Matches storybook design with centered gauge and stats below
 */

import React, { useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, TSpan } from 'react-native-svg';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatBalance, formatFiat } from '../../utils/formatters';

// Constants
const LIQUIDATION_RATE = 1.5;
const SVG_SIZE = 298;

// Path settings for different health zones
interface PathSetting {
  title: string;
  color: string;
  subtitle: string;
}

interface PathSettings {
  [key: string]: PathSetting;
}

const pathSettings: PathSettings = {
  red: {
    title: 'Risky',
    color: '#d04c68',
    subtitle: '135% - 160%',
  },
  yellow: {
    title: 'Moderate',
    color: '#fde37b',
    subtitle: '161% - 200%',
  },
  green: {
    title: 'Healthy',
    color: '#59aa8a',
    subtitle: '201% - 300%+',
  },
};

// Helper functions
const mapValueToRange = (value: number): number => {
  const inputMin = 125;
  const inputMax = 300;
  const outputMin = 11;
  const outputMax = 95;

  if (value >= 135 && value <= 160) {
    const specialMin = 135;
    const specialMax = 160;
    const specialOutputMin = 6;
    const specialOutputMax = 23.7;

    const t = (value - specialMin) / (specialMax - specialMin);
    const easedT = t * (1 + 0.2 * (1 - t));

    return specialOutputMin + (specialOutputMax - specialOutputMin) * easedT;
  }

  const clampedValue = Math.min(Math.max(value, inputMin), inputMax);
  return ((clampedValue - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) + outputMin;
};

const calculateDynamicRadius = (mappedValue: number): number => {
  if (mappedValue < 10) {
    return 142;
  } else if (mappedValue < 17) {
    return 140;
  } else if (mappedValue >= 17 && mappedValue < 19) {
    return 138;
  } else if (mappedValue >= 19 && mappedValue <= 24.7) {
    return 138;
  } else if (mappedValue <= 70) {
    return 135;
  } else {
    return 135 + ((mappedValue - 65) / 25) * 7;
  }
};

const getActivePath = (healthValue: number): keyof PathSettings | '' => {
  if (Number.isNaN(healthValue) || healthValue < 135 || !Number.isFinite(healthValue)) {
    return '';
  } else if (healthValue <= 160) {
    return 'red';
  } else if (healthValue <= 200) {
    return 'yellow';
  } else {
    return 'green';
  }
};

const getCurrentTitle = (activePath: keyof PathSettings | '', isLiquidated: boolean): string => {
  if (isLiquidated) {
    return 'Liquidating';
  }

  if (activePath && pathSettings[activePath]) {
    return pathSettings[activePath].title;
  }

  return 'N/A';
};

const getMarkerColor = (activePath: keyof PathSettings | '', isLiquidated: boolean): string => {
  if (isLiquidated) {
    return pathSettings.red.color;
  }
  if (activePath) {
    return pathSettings[activePath].color;
  }
  return '#59aa8a';
};

export interface VaultHealthGaugeProps {
  totalDebt: number;
  totalCollateral: number;
  currentPrice: number;
  healthPercentage: number;
  priceChange24h?: number;
  isLoading?: boolean;
  onBorrowPress?: () => void;
  onRepayPress?: () => void;
  onDepositPress?: () => void;
  onWithdrawPress?: () => void;
  onChartPress?: () => void;
}

export const VaultHealthGauge = memo(function VaultHealthGauge({
  totalDebt,
  totalCollateral,
  currentPrice,
  healthPercentage,
  onBorrowPress,
  onRepayPress,
  onDepositPress,
  onWithdrawPress,
  onChartPress,
}: VaultHealthGaugeProps): React.JSX.Element {
  // Memoize liquidation price calculation
  const liquidationPrice = useMemo(() =>
    totalDebt > 0 && totalCollateral > 0
      ? (totalDebt * LIQUIDATION_RATE) / totalCollateral
      : 0,
    [totalDebt, totalCollateral]
  );

  // Memoize all health metrics calculations together
  const healthMetrics = useMemo(() => {
    const healthValue = healthPercentage;
    const isLiquidated = healthValue < 135 && healthValue > 0;
    const activePath = getActivePath(healthValue);
    const currentTitle = getCurrentTitle(activePath, isLiquidated);
    const isHealthFinite = Number.isFinite(Number.parseFloat(healthValue.toFixed(2)));
    const displayHealthValue = healthValue > 500 ? '500+' : healthValue.toFixed(0);

    return {
      healthValue,
      isLiquidated,
      activePath,
      currentTitle,
      isHealthFinite,
      displayHealthValue,
    };
  }, [healthPercentage]);

  const { healthValue, isLiquidated, activePath, currentTitle, isHealthFinite, displayHealthValue } = healthMetrics;

  // Memoize marker position calculations
  const markerPosition = useMemo(() => {
    const centerX = SVG_SIZE / 2;
    const centerY = SVG_SIZE / 2;
    const mappedValue = mapValueToRange(healthValue);
    const radius = calculateDynamicRadius(mappedValue);
    const angle = isLiquidated ? 156 : (mappedValue / 100) * 260 - 220;
    const markerX = centerX + radius * Math.cos((angle * Math.PI) / 180) + (isLiquidated ? -4 : 0);
    const markerY = centerY + radius * Math.sin((angle * Math.PI) / 180);

    return { markerX, markerY };
  }, [healthValue, isLiquidated]);

  const { markerX, markerY } = markerPosition;

  // Memoize title color
  const titleColor = useMemo(() => {
    if (activePath && pathSettings[activePath]) {
      return pathSettings[activePath].color;
    }
    return '#ddd';
  }, [activePath]);

  // Memoize marker color
  const markerColor = useMemo(() =>
    getMarkerColor(activePath, isLiquidated),
    [activePath, isLiquidated]
  );

  return (
    <View style={styles.container}>
      {/* Gauge Container with Chart Button */}
      <View style={styles.gaugeContainer}>
        {/* Chart button - top right */}
        {onChartPress && (
          <TouchableOpacity style={styles.chartButton} onPress={onChartPress} activeOpacity={0.7}>
            <Icon name="chart" size={20} color={COLORS.WHITE} />
          </TouchableOpacity>
        )}

        <Svg
          width="100%"
          height="100%"
          viewBox={`-10 -10 ${SVG_SIZE + 20} ${(SVG_SIZE + 20) * 0.75}`}
        >
          {/* Red path (135% - 160%) */}
          <Path
            d="M21.7939 218.748C18.2888 220.422 14.0739 218.943 12.5684 215.362C4.08736 195.191 0.173205 173.361 1.14536 151.442C2.11751 129.524 7.94899 108.126 18.1826 88.7844C19.9991 85.3511 24.3284 84.2514 27.6716 86.229V86.229C31.0147 88.2066 32.1039 92.5122 30.3045 95.9545C21.2365 113.302 16.0676 132.453 15.1977 152.065C14.3279 171.677 17.7809 191.212 25.2775 209.294C26.7651 212.882 25.299 217.074 21.7939 218.748V218.748Z"
            fill={activePath === 'red' ? pathSettings.red.color : '#8e8d90'}
          />
          {/* Yellow path (161% - 200%) */}
          <Path
            d="M30.0049 82.4233C26.7261 80.3408 25.7425 75.9837 27.9784 72.8075C40.574 54.9144 56.9993 40.0117 76.0925 29.2037C95.1857 18.3956 116.417 11.9823 138.24 10.3916C142.114 10.1092 145.344 13.195 145.442 17.078V17.078C145.54 20.961 142.469 24.1691 138.596 24.4708C119.081 25.9912 100.106 31.7739 83.0218 41.4447C65.9377 51.1154 51.2139 64.4087 39.8667 80.3586C37.615 83.5236 33.2838 84.5058 30.0049 82.4233V82.4233Z"
            fill={activePath === 'yellow' ? pathSettings.yellow.color : '#8e8d90'}
          />
          {/* Green path (201% - 300%+) */}
          <Path
            d="M149.5 15.5331C149.5 11.6488 152.651 8.48256 156.531 8.66706C179.269 9.74835 201.486 16.0631 221.436 27.1585C243.437 39.395 261.954 57.0417 275.234 78.4294C288.514 99.8171 296.119 124.239 297.329 149.385C298.426 172.186 294.233 194.9 285.118 215.759C283.563 219.319 279.328 220.738 275.847 219.016V219.016C272.365 217.293 270.958 213.081 272.495 209.514C280.559 190.805 284.261 170.472 283.279 150.061C282.184 127.305 275.302 105.204 263.284 85.8493C251.266 66.4943 234.509 50.5249 214.599 39.4513C196.741 29.5191 176.875 23.82 156.53 22.7508C152.651 22.5469 149.5 19.4174 149.5 15.5331V15.5331Z"
            fill={activePath === 'green' ? pathSettings.green.color : '#8e8d90'}
          />

          {/* Marker */}
          {isHealthFinite && (
            <Circle
              cx={Number.isNaN(markerX) ? 108.16 : markerX}
              cy={Number.isNaN(markerY) ? 13 : markerY}
              r={10.9}
              fill="#111015"
              stroke={markerColor}
              strokeWidth={10.2}
            />
          )}

          {/* Center Title (Healthy/Moderate/Risky) */}
          <SvgText
            x={SVG_SIZE / 2}
            y={SVG_SIZE / 2 - 20}
            textAnchor="middle"
            fill={titleColor}
            fontSize={24}
            fontWeight="500"
          >
            <TSpan>{currentTitle}</TSpan>
          </SvgText>

          {/* Vault Health % below the title */}
          <SvgText
            x={SVG_SIZE / 2}
            y={SVG_SIZE / 2 + 15}
            textAnchor="middle"
            fill={titleColor}
            fontSize={32}
            fontWeight="600"
          >
            <TSpan>{isHealthFinite ? `${displayHealthValue}%` : 'N/A'}</TSpan>
          </SvgText>

          {/* 135% label */}
          <SvgText
            x={56}
            y={212}
            textAnchor="middle"
            fill="#ddd"
            fillOpacity={0.5}
            fontSize={12}
          >
            <TSpan>135%</TSpan>
          </SvgText>

          {/* 160% label */}
          <SvgText
            x={56}
            y={98}
            textAnchor="middle"
            fill="#ddd"
            fillOpacity={0.5}
            fontSize={12}
          >
            <TSpan>160%</TSpan>
          </SvgText>

          {/* 200% label */}
          <SvgText
            x={149}
            y={40}
            textAnchor="middle"
            fill="#ddd"
            fillOpacity={0.5}
            fontSize={12}
          >
            <TSpan>200%</TSpan>
          </SvgText>

          {/* 300% label */}
          <SvgText
            x={248}
            y={212}
            textAnchor="middle"
            fill="#ddd"
            fillOpacity={0.5}
            fontSize={12}
          >
            <TSpan>300%</TSpan>
          </SvgText>
        </Svg>
      </View>

      {/* Stats Row - Debt | Collateral */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Debt</Text>
          <View style={styles.statValueRow}>
            <Icon name="unit_symbol" size={16} color={COLORS.WHITE} />
            <Text style={styles.statValue}>{formatFiat(totalDebt)}</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Collateral</Text>
          <View style={styles.statValueRow}>
            <Icon name="btc_symbol" size={16} color={COLORS.WHITE} />
            <Text style={styles.statValue}>{formatBalance(totalCollateral)}</Text>
          </View>
        </View>
      </View>

      {/* Liquidation Price */}
      <View style={styles.liquidationRow}>
        <Text style={styles.liquidationLabel}>Liquidation Price</Text>
        <Text style={[styles.liquidationValue, { color: titleColor }]}>
          ${formatFiat(liquidationPrice, 0)}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onDepositPress}>
          <View style={styles.actionButtonIcon}>
            <Text style={styles.buttonIcon}>+</Text>
          </View>
          <Text style={styles.actionButtonLabel}>Deposit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onBorrowPress}>
          <View style={styles.actionButtonIcon}>
            <Text style={styles.buttonIcon}>↑</Text>
          </View>
          <Text style={styles.actionButtonLabel}>Borrow</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onRepayPress}>
          <View style={styles.actionButtonIcon}>
            <Text style={styles.buttonIcon}>↓</Text>
          </View>
          <Text style={styles.actionButtonLabel}>Repay</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onWithdrawPress}>
          <View style={styles.actionButtonIcon}>
            <Text style={styles.buttonIcon}>−</Text>
          </View>
          <Text style={styles.actionButtonLabel}>Withdraw</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  gaugeContainer: {
    width: '100%',
    aspectRatio: 1.5,
    marginBottom: 16,
    position: 'relative',
  },
  chartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.DARK_GRAY,
  },
  liquidationRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  liquidationLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 4,
  },
  liquidationValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  buttonIcon: {
    fontSize: 24,
    color: COLORS.DARK_BG,
    fontWeight: '200',
  },
  actionButtonLabel: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
});

export default VaultHealthGauge;
