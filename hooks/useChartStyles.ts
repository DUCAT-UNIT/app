import { useResponsive } from './useResponsive';
import { ScreenSize } from '../styles/responsive';

interface ChartSizeConfig {
  chartWidth: number;
  iconSize: number;
  fontSize: number;
  dateFontSize: number;
  padding: number;
  minWidth: number;
  chipFontSize: number;
  chipPaddingH: number;
  chipPaddingV: number;
  chipMinWidth: number;
  amountFontSize: number;
  amountIconSize: number;
}

const CHART_SIZES: Record<ScreenSize, ChartSizeConfig> = {
  XS: {
    chartWidth: 288,
    iconSize: 28,
    fontSize: 11,
    dateFontSize: 10,
    padding: 12,
    minWidth: 70,
    chipFontSize: 9,
    chipPaddingH: 5,
    chipPaddingV: 2,
    chipMinWidth: 60,
    amountFontSize: 11,
    amountIconSize: 9,
  },
  S: {
    chartWidth: 343,
    iconSize: 32,
    fontSize: 12,
    dateFontSize: 11,
    padding: 14,
    minWidth: 80,
    chipFontSize: 11,
    chipPaddingH: 6,
    chipPaddingV: 3,
    chipMinWidth: 70,
    amountFontSize: 12,
    amountIconSize: 10,
  },
  M: {
    chartWidth: 358,
    iconSize: 36,
    fontSize: 14,
    dateFontSize: 12,
    padding: 16,
    minWidth: 85,
    chipFontSize: 12,
    chipPaddingH: 8,
    chipPaddingV: 4,
    chipMinWidth: 80,
    amountFontSize: 14,
    amountIconSize: 12,
  },
  L: {
    chartWidth: 361,
    iconSize: 38,
    fontSize: 14,
    dateFontSize: 12,
    padding: 16,
    minWidth: 88,
    chipFontSize: 13,
    chipPaddingH: 8,
    chipPaddingV: 4,
    chipMinWidth: 82,
    amountFontSize: 14,
    amountIconSize: 12,
  },
  XL: {
    chartWidth: 398,
    iconSize: 40,
    fontSize: 15,
    dateFontSize: 12,
    padding: 18,
    minWidth: 95,
    chipFontSize: 14,
    chipPaddingH: 10,
    chipPaddingV: 5,
    chipMinWidth: 90,
    amountFontSize: 15,
    amountIconSize: 13,
  },
};

export const CHART_HEIGHT = 160;

export interface ChartStyles extends ChartSizeConfig {
  chartHeight: number;
}

export function useChartStyles(): ChartStyles {
  const { screenSize } = useResponsive();

  const config = CHART_SIZES[screenSize];

  return {
    ...config,
    chartHeight: CHART_HEIGHT,
  };
}
