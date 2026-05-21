/**
 * VaultActionGauge Component
 * Compact semicircular gauge for vault action screens showing health transition
 * Shows current health with optional preview of new health after action
 */

import React,{ memo,useMemo } from 'react';
import { StyleSheet,View } from 'react-native';
import Svg,{ Circle,Path,Text as SvgText,TSpan } from 'react-native-svg';

const SVG_SIZE = 200;

interface PathSettings {
  [key: string]: {
    title: string;
    color: string;
  };
}

const pathSettings: PathSettings = {
  red: { title: 'Risky', color: '#d04c68' },
  yellow: { title: 'Moderate', color: '#fde37b' },
  green: { title: 'Healthy', color: '#59aa8a' },
};

const mapValueToRange = (value: number): number => {
  const inputMin = 125;
  const inputMax = 300;
  const outputMin = 11;
  const outputMax = 95;
  const redStartOutput = 6;
  const redYellowBoundaryOutput = 27;
  const yellowGreenBoundaryOutput = 50;

  const interpolate = (
    current: number,
    min: number,
    max: number,
    outputStart: number,
    outputEnd: number
  ): number => {
    const t = (current - min) / (max - min);
    return outputStart + (outputEnd - outputStart) * t;
  };

  if (value >= 135 && value <= 160) {
    const specialMin = 135;
    const specialMax = 160;
    const t = (value - specialMin) / (specialMax - specialMin);
    const easedT = t * (1 + 0.2 * (1 - t));
    return redStartOutput + (redYellowBoundaryOutput - redStartOutput) * easedT;
  }

  if (value > 160 && value <= 200) {
    return interpolate(value, 160, 200, redYellowBoundaryOutput, yellowGreenBoundaryOutput);
  }

  if (value > 200) {
    const clampedValue = Math.min(value, inputMax);
    return interpolate(clampedValue, 200, inputMax, yellowGreenBoundaryOutput, outputMax);
  }

  const clampedValue = Math.min(Math.max(value, inputMin), inputMax);
  return ((clampedValue - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) + outputMin;
};

const calculateDynamicRadius = (mappedValue: number): number => {
  if (mappedValue < 10) return 95;
  if (mappedValue < 17) return 93;
  if (mappedValue >= 17 && mappedValue < 19) return 92;
  if (mappedValue >= 19 && mappedValue <= 24.7) return 92;
  if (mappedValue <= 70) return 90;
  return 90 + ((mappedValue - 65) / 25) * 5;
};

const getActivePath = (healthValue: number): keyof PathSettings | '' => {
  if (Number.isNaN(healthValue) || healthValue < 135 || !Number.isFinite(healthValue)) return '';
  if (healthValue <= 160) return 'red';
  if (healthValue <= 200) return 'yellow';
  return 'green';
};

const getHealthColor = (healthValue: number): string => {
  const path = getActivePath(healthValue);
  if (path && pathSettings[path]) return pathSettings[path].color;
  return '#ddd';
};

const getHealthTitle = (healthValue: number): string => {
  const path = getActivePath(healthValue);
  if (path && pathSettings[path]) return pathSettings[path].title;
  return 'N/A';
};

export interface VaultActionGaugeProps {
  currentHealth: number;
  newHealth?: number;
  showTransition?: boolean;
  hasNoDebt?: boolean;
}

export const VaultActionGauge = memo(function VaultActionGauge({
  currentHealth,
  newHealth,
  showTransition = false,
  hasNoDebt = false,
}: VaultActionGaugeProps): React.JSX.Element {
  const displayHealth = showTransition && newHealth !== undefined ? newHealth : currentHealth;
  const hasNoData = displayHealth <= 0 && !hasNoDebt;

  const healthMetrics = useMemo(() => {
    // Show infinity when there's no debt
    if (hasNoDebt) {
      return {
        activePath: 'green' as keyof PathSettings | '',
        displayValue: '\u221E',
        titleColor: pathSettings.green.color,
        isHealthFinite: false,
        isInfinite: true,
      };
    }

    if (hasNoData) {
      return {
        activePath: '' as keyof PathSettings | '',
        displayValue: 'N/A',
        titleColor: '#ddd',
        isHealthFinite: false,
        isInfinite: false,
      };
    }

    const activePath = getActivePath(displayHealth);
    const displayValue = displayHealth > 500 ? '500+' : displayHealth.toFixed(0);
    const titleColor = getHealthColor(displayHealth);
    const isHealthFinite = Number.isFinite(displayHealth);

    return { activePath, displayValue, titleColor, isHealthFinite, isInfinite: false };
  }, [displayHealth, hasNoData, hasNoDebt]);

  const { activePath, displayValue, titleColor, isHealthFinite, isInfinite } = healthMetrics;

  const markerPosition = useMemo(() => {
    const centerX = SVG_SIZE / 2;
    const centerY = SVG_SIZE / 2;
    const mappedValue = mapValueToRange(displayHealth);
    const radius = calculateDynamicRadius(mappedValue);
    const angle = (mappedValue / 100) * 260 - 220;
    const markerX = centerX + radius * Math.cos((angle * Math.PI) / 180);
    const markerY = centerY + radius * Math.sin((angle * Math.PI) / 180);
    return { markerX, markerY };
  }, [displayHealth]);

  const { markerX, markerY } = markerPosition;

  // Scale factor for compact gauge
  const scale = SVG_SIZE / 298;

  // Build accessibility label
  const accessibilityLabel = useMemo(() => {
    if (isInfinite || hasNoDebt) {
      return 'Vault health: Healthy, no debt';
    }
    if (hasNoData) {
      return 'Vault health: Not available';
    }
    const healthTitle = getHealthTitle(displayHealth);
    const healthPercent = displayHealth > 500 ? 'over 500' : displayHealth.toFixed(0);
    return `Vault health: ${healthTitle}, ${healthPercent} percent`;
  }, [isInfinite, hasNoDebt, hasNoData, displayHealth]);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.gaugeContainer} accessibilityElementsHidden>
        <Svg
          width="100%"
          height="100%"
          viewBox={`-10 -10 ${SVG_SIZE + 20} ${(SVG_SIZE + 20) * 0.75}`}
        >
          {/* Red path (135% - 160%) */}
          <Path
            d="M21.7939 218.748C18.2888 220.422 14.0739 218.943 12.5684 215.362C4.08736 195.191 0.173205 173.361 1.14536 151.442C2.11751 129.524 7.94899 108.126 18.1826 88.7844C19.9991 85.3511 24.3284 84.2514 27.6716 86.229V86.229C31.0147 88.2066 32.1039 92.5122 30.3045 95.9545C21.2365 113.302 16.0676 132.453 15.1977 152.065C14.3279 171.677 17.7809 191.212 25.2775 209.294C26.7651 212.882 25.299 217.074 21.7939 218.748V218.748Z"
            fill={activePath === 'red' ? pathSettings.red.color : '#8e8d90'}
            scale={scale}
          />
          {/* Yellow path (161% - 200%) */}
          <Path
            d="M30.0049 82.4233C26.7261 80.3408 25.7425 75.9837 27.9784 72.8075C40.574 54.9144 56.9993 40.0117 76.0925 29.2037C95.1857 18.3956 116.417 11.9823 138.24 10.3916C142.114 10.1092 145.344 13.195 145.442 17.078V17.078C145.54 20.961 142.469 24.1691 138.596 24.4708C119.081 25.9912 100.106 31.7739 83.0218 41.4447C65.9377 51.1154 51.2139 64.4087 39.8667 80.3586C37.615 83.5236 33.2838 84.5058 30.0049 82.4233V82.4233Z"
            fill={activePath === 'yellow' ? pathSettings.yellow.color : '#8e8d90'}
            scale={scale}
          />
          {/* Green path (201% - 300%+) */}
          <Path
            d="M149.5 15.5331C149.5 11.6488 152.651 8.48256 156.531 8.66706C179.269 9.74835 201.486 16.0631 221.436 27.1585C243.437 39.395 261.954 57.0417 275.234 78.4294C288.514 99.8171 296.119 124.239 297.329 149.385C298.426 172.186 294.233 194.9 285.118 215.759C283.563 219.319 279.328 220.738 275.847 219.016V219.016C272.365 217.293 270.958 213.081 272.495 209.514C280.559 190.805 284.261 170.472 283.279 150.061C282.184 127.305 275.302 105.204 263.284 85.8493C251.266 66.4943 234.509 50.5249 214.599 39.4513C196.741 29.5191 176.875 23.82 156.53 22.7508C152.651 22.5469 149.5 19.4174 149.5 15.5331V15.5331Z"
            fill={activePath === 'green' ? pathSettings.green.color : '#8e8d90'}
            scale={scale}
          />

          {/* Marker */}
          {isHealthFinite && !isInfinite && (
            <Circle
              cx={Number.isNaN(markerX) ? SVG_SIZE / 2 : markerX}
              cy={Number.isNaN(markerY) ? 10 : markerY}
              r={7}
              fill="#111015"
              stroke={titleColor}
              strokeWidth={6}
            />
          )}

          {/* Center Title */}
          <SvgText
            x={SVG_SIZE / 2}
            y={SVG_SIZE / 2 - 10}
            textAnchor="middle"
            fill={titleColor}
            fontSize={16}
            fontWeight="500"
          >
            <TSpan>{isInfinite ? 'Healthy' : getHealthTitle(displayHealth)}</TSpan>
          </SvgText>

          {/* Health percentage */}
          <SvgText
            x={SVG_SIZE / 2}
            y={SVG_SIZE / 2 + 15}
            textAnchor="middle"
            fill={titleColor}
            fontSize={24}
            fontWeight="600"
          >
            <TSpan>{isInfinite ? displayValue : (isHealthFinite ? `${displayValue}%` : 'N/A')}</TSpan>
          </SvgText>

          {/* Min label (135%) */}
          <SvgText
            x={28}
            y={SVG_SIZE / 2 + 50}
            textAnchor="start"
            fill="#8e8d90"
            fontSize={11}
            fontWeight="500"
          >
            <TSpan>135%</TSpan>
          </SvgText>

          {/* Max label (300%+) */}
          <SvgText
            x={SVG_SIZE - 28}
            y={SVG_SIZE / 2 + 50}
            textAnchor="end"
            fill="#8e8d90"
            fontSize={11}
            fontWeight="500"
          >
            <TSpan>300%+</TSpan>
          </SvgText>
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: -24,
    marginBottom: -24,
  },
  gaugeContainer: {
    width: '100%',
    maxWidth: 220,
    aspectRatio: 1.5,
  },
});
