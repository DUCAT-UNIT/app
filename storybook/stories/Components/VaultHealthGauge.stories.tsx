import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import Svg, { Path, Circle, Text as SvgText, TSpan } from 'react-native-svg';
import { COLORS } from '../../../theme';

const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone 5', scale: 0.7 },
  { width: 375, size: 'S', label: 'iPhone SE/8', scale: 0.8 },
  { width: 390, size: 'M', label: 'iPhone 12/13/14', scale: 0.9 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.0 },
];

const SVG_SIZE = 298;

const pathSettings = {
  red: { title: 'Risky', color: '#d04c68' },
  yellow: { title: 'Moderate', color: '#fde37b' },
  green: { title: 'Healthy', color: '#59aa8a' },
};

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
  if (mappedValue < 10) return 142;
  if (mappedValue < 17) return 140;
  if (mappedValue >= 17 && mappedValue < 19) return 138;
  if (mappedValue >= 19 && mappedValue <= 24.7) return 138;
  if (mappedValue <= 70) return 135;
  return 135 + ((mappedValue - 65) / 25) * 7;
};

const getActivePath = (healthValue: number): 'red' | 'yellow' | 'green' | '' => {
  if (Number.isNaN(healthValue) || healthValue < 135 || !Number.isFinite(healthValue)) return '';
  if (healthValue <= 160) return 'red';
  if (healthValue <= 200) return 'yellow';
  return 'green';
};

type DeviceSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

interface HealthDialProps {
  healthPercentage: number;
  scale?: number;
  deviceSize?: DeviceSize;
}

const HealthDial = ({ healthPercentage, scale = 1 }: HealthDialProps) => {
  const isLiquidated = healthPercentage < 135 && healthPercentage > 0;
  const activePath = getActivePath(healthPercentage);
  const isHealthFinite = Number.isFinite(healthPercentage);
  const displayHealthValue = healthPercentage > 500 ? '500+' : healthPercentage.toFixed(0);

  const currentTitle = isLiquidated
    ? 'Liquidating'
    : activePath
    ? pathSettings[activePath].title
    : 'N/A';

  const titleColor = activePath ? pathSettings[activePath].color : '#ddd';

  const mappedValue = mapValueToRange(healthPercentage);
  const radius = calculateDynamicRadius(mappedValue);
  const centerX = SVG_SIZE / 2;
  const centerY = SVG_SIZE / 2;
  const angle = isLiquidated ? 156 : (mappedValue / 100) * 260 - 220;
  const markerX = centerX + radius * Math.cos((angle * Math.PI) / 180) + (isLiquidated ? -4 : 0);
  const markerY = centerY + radius * Math.sin((angle * Math.PI) / 180);

  const markerColor = isLiquidated
    ? pathSettings.red.color
    : activePath
    ? pathSettings[activePath].color
    : '#59aa8a';

  const titleFontSize = 24 * scale;
  const healthFontSize = 32 * scale;
  const labelFontSize = 12 * scale;

  return (
    <View style={[styles.gaugeContainer, { width: 300 * scale }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`-10 -10 ${SVG_SIZE + 20} ${(SVG_SIZE + 20) * 0.8}`}
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
          <>
            {isLiquidated && (
              <Circle
                cx={Number.isNaN(markerX) ? 108.16 : markerX}
                cy={Number.isNaN(markerY) ? 13 : markerY}
                r={18}
                fill="none"
                stroke="#000000"
                strokeWidth={3}
              />
            )}
            <Circle
              cx={Number.isNaN(markerX) ? 108.16 : markerX}
              cy={Number.isNaN(markerY) ? 13 : markerY}
              r={10.9}
              fill="#111015"
              stroke={markerColor}
              strokeWidth={10.2}
            />
          </>
        )}

        {/* Center Title */}
        <SvgText
          x={SVG_SIZE / 2}
          y={SVG_SIZE / 2 - 20}
          textAnchor="middle"
          fill={titleColor}
          fontSize={titleFontSize}
          fontWeight="500"
          fontFamily="CabinetGrotesk-Medium"
        >
          <TSpan>{currentTitle}</TSpan>
        </SvgText>

        {/* Health % */}
        <SvgText
          x={SVG_SIZE / 2}
          y={SVG_SIZE / 2 + 15}
          textAnchor="middle"
          fill={titleColor}
          fontSize={healthFontSize}
          fontWeight="600"
          fontFamily="CabinetGrotesk-Bold"
        >
          <TSpan>{isHealthFinite ? `${displayHealthValue}%` : 'N/A'}</TSpan>
        </SvgText>

        {/* Labels */}
        <SvgText x={56} y={212} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={labelFontSize} fontFamily="CabinetGrotesk-Medium">
          <TSpan>135%</TSpan>
        </SvgText>
        <SvgText x={56} y={98} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={labelFontSize} fontFamily="CabinetGrotesk-Medium">
          <TSpan>160%</TSpan>
        </SvgText>
        <SvgText x={149} y={40} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={labelFontSize} fontFamily="CabinetGrotesk-Medium">
          <TSpan>200%</TSpan>
        </SvgText>
        <SvgText x={248} y={212} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={labelFontSize} fontFamily="CabinetGrotesk-Medium">
          <TSpan>300%</TSpan>
        </SvgText>
      </Svg>
    </View>
  );
};

const meta: Meta = {
  title: 'Components/VaultHealthGauge',
};

export default meta;
export const VaultHealthGauge: StoryObj<HealthDialProps> = {
  render: (args) => {
    const config = DEVICE_CONFIGS.find(d => d.size === args.deviceSize) || DEVICE_CONFIGS[3];
    return (
      <View style={styles.container}>
        <HealthDial healthPercentage={args.healthPercentage} scale={config.scale} />
      </View>
    );
  },
  args: {
    healthPercentage: 245,
    deviceSize: 'L',
  },
  argTypes: {
    healthPercentage: {
      control: { type: 'range', min: 100, max: 350, step: 1 },
      description: 'Vault health percentage',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
  },
};

const DeviceSizeOverviewStory = ({ healthPercentage }: { healthPercentage: number }) => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {DEVICE_CONFIGS.map(({ width, size, label, scale }) => (
      <View key={width} style={styles.deviceSection}>
        <Text style={styles.sizeLabel}>{size}</Text>
        <Text style={styles.deviceLabel}>{label} ({width}px)</Text>
        <View style={{ width, alignItems: 'center' }}>
          <HealthDial healthPercentage={healthPercentage} scale={scale} />
        </View>
      </View>
    ))}
  </ScrollView>
);

export const DeviceSizeOverview: StoryObj<HealthDialProps> = {
  render: (args) => <DeviceSizeOverviewStory healthPercentage={args.healthPercentage} />,
  args: {
    healthPercentage: 245,
  },
  argTypes: {
    healthPercentage: {
      control: { type: 'range', min: 100, max: 350, step: 1 },
      description: 'Vault health percentage',
    },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    gap: 24,
    alignItems: 'center',
  },
  deviceSection: {
    gap: 8,
    alignItems: 'center',
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  gaugeContainer: {
    width: 300,
    aspectRatio: 1.5,
  },
});
