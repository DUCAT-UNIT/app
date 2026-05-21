/**
 * Vault Health Gauge Utilities
 * Constants and helper functions for the VaultHealthGauge component
 */

// Constants
export const LIQUIDATION_RATE = 1.5;
export const SVG_SIZE = 298;
// Minimum collateral for withdraw (in BTC) - covers taproot input (~58vB) + outputs (~86vB) + overhead at ~10sat/vB
export const MIN_WITHDRAW_COLLATERAL = 0.00002; // ~2000 sats

// Path settings for different health zones
export interface PathSetting {
  title: string;
  color: string;
  subtitle: string;
}

export interface PathSettings {
  [key: string]: PathSetting;
}

export const pathSettings: PathSettings = {
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

/**
 * Map health percentage to gauge position
 */
export const mapValueToRange = (value: number): number => {
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

/**
 * Calculate marker radius based on position
 */
export const calculateDynamicRadius = (mappedValue: number): number => {
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

/**
 * Get active path zone based on health value
 */
export const getActivePath = (healthValue: number): keyof PathSettings | '' => {
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

/**
 * Get title text for current health state
 */
export const getCurrentTitle = (activePath: keyof PathSettings | '', isLiquidated: boolean): string => {
  if (isLiquidated) {
    return 'Liquidating';
  }

  if (activePath && pathSettings[activePath]) {
    return pathSettings[activePath].title;
  }

  return 'N/A';
};

/**
 * Get marker color for current health state
 */
export const getMarkerColor = (activePath: keyof PathSettings | '', isLiquidated: boolean): string => {
  if (isLiquidated) {
    return pathSettings.red.color;
  }
  if (activePath) {
    return pathSettings[activePath].color;
  }
  return '#59aa8a';
};
