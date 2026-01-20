/**
 * VaultHealthGauge Component
 * Displays a semicircular gauge showing vault health status
 * Matches storybook design with centered gauge and stats below
 */

import React, { useMemo, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, TSpan } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';
import { useNotificationStore } from '../../stores/notificationStore';

// Constants
const LIQUIDATION_RATE = 1.5;
const SVG_SIZE = 298;
// Minimum collateral for withdraw (in BTC) - covers taproot input (~58vB) + outputs (~86vB) + overhead at ~10sat/vB
const MIN_WITHDRAW_COLLATERAL = 0.00002; // ~2000 sats

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
  isPendingTransaction?: boolean;
  walletBtcBalance?: number;
  walletUnitBalance?: number;
  onBorrowPress?: () => void;
  onRepayPress?: () => void;
  onDepositPress?: () => void;
  onWithdrawPress?: () => void;
}

export const VaultHealthGauge = memo(function VaultHealthGauge({
  totalDebt,
  totalCollateral,
  currentPrice,
  healthPercentage,
  isPendingTransaction = false,
  walletBtcBalance = 0,
  walletUnitBalance = 0,
  onBorrowPress,
  onRepayPress,
  onDepositPress,
  onWithdrawPress,
}: VaultHealthGaugeProps): React.JSX.Element {
  const { s, sf } = useResponsive();

  // Check if health is below minimum (160%)
  const isLowHealth = healthPercentage > 0 && healthPercentage < 160;

  // Handler for disabled vault action buttons - shows popup with haptic feedback
  const handleDisabledPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Transaction pending',
      description: 'Please wait for the current vault transaction to confirm',
      type: 'warning',
    });
  }, []);

  // Handler for low health - shows popup with haptic feedback
  const handleLowHealthPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Health too low',
      description: 'Vault health must be above 160% to withdraw or borrow',
      type: 'warning',
    });
  }, []);

  // Handler for no debt (can't repay/borrow) - shows popup with haptic feedback
  const handleNoDebtPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No debt',
      description: 'You have no UNIT debt to repay or borrow against',
      type: 'warning',
    });
  }, []);

  // Handler for insufficient funds to withdraw - shows popup with haptic feedback
  const handleInsufficientFundsPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Insufficient funds',
      description: 'Not enough collateral to cover withdrawal transaction fees',
      type: 'warning',
    });
  }, []);

  // Handler for no BTC in wallet - shows popup with haptic feedback
  const handleNoBtcPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No BTC available',
      description: 'You need BTC in your wallet to pay for transaction fees',
      type: 'warning',
    });
  }, []);

  // Handler for no UNIT in wallet - shows popup with haptic feedback
  const handleNoUnitPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No UNIT available',
      description: 'You need UNIT in your wallet to repay',
      type: 'warning',
    });
  }, []);

  // Memoize liquidation price calculation
  const liquidationPrice = useMemo(() =>
    totalDebt > 0 && totalCollateral > 0
      ? (totalDebt * LIQUIDATION_RATE) / totalCollateral
      : 0,
    [totalDebt, totalCollateral]
  );

  const hasNoDebt = totalDebt === 0;
  const hasInsufficientCollateral = totalCollateral < MIN_WITHDRAW_COLLATERAL;
  const hasNoBtc = walletBtcBalance <= 0;
  const hasNoUnit = walletUnitBalance <= 0;

  const healthMetrics = useMemo(() => {
    if (hasNoDebt) {
      return {
        healthValue: 0,
        isLiquidated: false,
        activePath: 'green' as keyof PathSettings | '',
        currentTitle: 'Healthy',
        isHealthFinite: false,
        displayHealthValue: '\u221E',
        isInfinite: true,
      };
    }

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
      isInfinite: false,
    };
  }, [healthPercentage, hasNoDebt]);

  const { healthValue, isLiquidated, activePath, currentTitle, isHealthFinite, displayHealthValue, isInfinite } = healthMetrics;

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
    <View style={[styles.container, { paddingHorizontal: s(24), paddingTop: s(8) }]}>
      {/* Gauge Container */}
      <View style={[styles.gaugeContainer, { marginBottom: s(8) }]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`-10 -10 ${SVG_SIZE + 20} ${(SVG_SIZE + 20) * 0.78}`}
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
          {isHealthFinite && !isInfinite && (
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
            <TSpan>{isInfinite ? displayHealthValue : (isHealthFinite ? `${displayHealthValue}%` : 'N/A')}</TSpan>
          </SvgText>

          {/* 135% label */}
          <SvgText
            x={56}
            y={222}
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
            x={235}
            y={222}
            textAnchor="middle"
            fill="#ddd"
            fillOpacity={0.5}
            fontSize={12}
          >
            <TSpan>300%</TSpan>
          </SvgText>
        </Svg>
      </View>

      {/* Liquidation Price - moved up */}
      <View style={[styles.liquidationRow, { marginBottom: s(16) }]}>
        <Text style={[styles.liquidationLabel, { fontSize: sf(14), marginBottom: s(2) }]}>Liquidation Price</Text>
        <Text style={[styles.liquidationValue, { color: COLORS.DANGER_RED, fontSize: sf(18) }]}>
          {hasNoDebt ? '\u221E' : `$${formatFiat(liquidationPrice, 0)}`}
        </Text>
      </View>

      {/* Stats Row - Collateral | Debt with action buttons below each */}
      <View style={[styles.statsRow, { marginBottom: s(8) }]}>
        {/* Collateral Column with Deposit/Withdraw */}
        <View style={[styles.statColumn, { paddingHorizontal: s(16) }]}>
          <Text style={[styles.statLabel, { fontSize: sf(14), marginBottom: s(4) }]}>Locked Bitcoin</Text>
          <View style={[styles.statValueRow, { gap: s(4), marginBottom: s(12) }]}>
            <Icon name="btc_symbol" size={s(18)} color={COLORS.WHITE} />
            <Text style={[styles.statValue, { fontSize: sf(20) }]}>{formatBalance(totalCollateral)}</Text>
          </View>
          <View style={[styles.buttonPair, { gap: s(8) }]}>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }, (isPendingTransaction || hasNoBtc) && styles.actionButtonDisabled]}
              onPress={isPendingTransaction ? handleDisabledPress : hasNoBtc ? handleNoBtcPress : onDepositPress}
            >
              <View style={[styles.actionButtonIcon, { width: s(56), height: s(56), borderRadius: s(8), marginBottom: s(2) }, (isPendingTransaction || hasNoBtc) && styles.actionButtonIconDisabled]}>
                <Text style={[styles.buttonIcon, { fontSize: sf(25) }, (isPendingTransaction || hasNoBtc) && styles.buttonIconDisabled]}>+</Text>
              </View>
              <Text style={[styles.actionButtonLabel, { fontSize: sf(10) }, (isPendingTransaction || hasNoBtc) && styles.actionButtonLabelDisabled]}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }, (isPendingTransaction || isLowHealth || hasInsufficientCollateral) && styles.actionButtonDisabled]}
              onPress={isPendingTransaction ? handleDisabledPress : hasInsufficientCollateral ? handleInsufficientFundsPress : isLowHealth ? handleLowHealthPress : onWithdrawPress}
            >
              <View style={[styles.actionButtonIcon, { width: s(56), height: s(56), borderRadius: s(8), marginBottom: s(2) }, (isPendingTransaction || isLowHealth || hasInsufficientCollateral) && styles.actionButtonIconDisabled]}>
                <Text style={[styles.buttonIcon, { fontSize: sf(25) }, (isPendingTransaction || isLowHealth || hasInsufficientCollateral) && styles.buttonIconDisabled]}>−</Text>
              </View>
              <Text style={[styles.actionButtonLabel, { fontSize: sf(10) }, (isPendingTransaction || isLowHealth || hasInsufficientCollateral) && styles.actionButtonLabelDisabled]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.statDivider, { height: s(120) }]} />

        {/* Debt Column with Borrow/Repay */}
        <View style={[styles.statColumn, { paddingHorizontal: s(16) }]}>
          <Text style={[styles.statLabel, { fontSize: sf(14), marginBottom: s(4) }]}>UNIT Debt</Text>
          <View style={[styles.statValueRow, { gap: s(4), marginBottom: s(12) }]}>
            <Icon name="unit_symbol" size={s(18)} color={COLORS.WHITE} />
            <Text style={[styles.statValue, { fontSize: sf(20) }]}>{formatFiat(totalDebt)}</Text>
          </View>
          <View style={[styles.buttonPair, { gap: s(8) }]}>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }, (isPendingTransaction || isLowHealth || hasNoDebt || hasNoBtc) && styles.actionButtonDisabled]}
              onPress={isPendingTransaction ? handleDisabledPress : hasNoBtc ? handleNoBtcPress : hasNoDebt ? handleNoDebtPress : isLowHealth ? handleLowHealthPress : onBorrowPress}
            >
              <View style={[styles.actionButtonIcon, { width: s(56), height: s(56), borderRadius: s(8), marginBottom: s(2) }, (isPendingTransaction || isLowHealth || hasNoDebt || hasNoBtc) && styles.actionButtonIconDisabled]}>
                <Text style={[styles.buttonIcon, { fontSize: sf(25) }, (isPendingTransaction || isLowHealth || hasNoDebt || hasNoBtc) && styles.buttonIconDisabled]}>↑</Text>
              </View>
              <Text style={[styles.actionButtonLabel, { fontSize: sf(10) }, (isPendingTransaction || isLowHealth || hasNoDebt || hasNoBtc) && styles.actionButtonLabelDisabled]}>Borrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }, (isPendingTransaction || hasNoDebt || hasNoUnit || hasNoBtc) && styles.actionButtonDisabled]}
              onPress={isPendingTransaction ? handleDisabledPress : hasNoBtc ? handleNoBtcPress : hasNoDebt ? handleNoDebtPress : hasNoUnit ? handleNoUnitPress : onRepayPress}
            >
              <View style={[styles.actionButtonIcon, { width: s(56), height: s(56), borderRadius: s(8), marginBottom: s(2) }, (isPendingTransaction || hasNoDebt || hasNoUnit || hasNoBtc) && styles.actionButtonIconDisabled]}>
                <Text style={[styles.buttonIcon, { fontSize: sf(25) }, (isPendingTransaction || hasNoDebt || hasNoUnit || hasNoBtc) && styles.buttonIconDisabled]}>↓</Text>
              </View>
              <Text style={[styles.actionButtonLabel, { fontSize: sf(10) }, (isPendingTransaction || hasNoDebt || hasNoUnit || hasNoBtc) && styles.actionButtonLabelDisabled]}>Repay</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
  statColumn: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.DARK_GRAY,
  },
  buttonPair: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonIconDisabled: {
    backgroundColor: COLORS.DARK_GRAY,
  },
  buttonIconDisabled: {
    color: COLORS.SECONDARY_TEXT,
  },
  actionButtonLabelDisabled: {
    color: COLORS.SECONDARY_TEXT,
  },
});

export default VaultHealthGauge;
