import { useResponsive } from './useResponsive';
import { ScreenSize } from '../styles/responsive';

interface BannerSizeConfig {
  fontSize: number;
  paddingVertical: number;
  paddingHorizontal: number;
  iconSize: number;
  iconMargin: number;
}

const BANNER_SIZES: Record<ScreenSize, BannerSizeConfig> = {
  XS: {
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    iconSize: 14,
    iconMargin: 12,
  },
  S: {
    fontSize: 13,
    paddingVertical: 7,
    paddingHorizontal: 14,
    iconSize: 16,
    iconMargin: 16,
  },
  M: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    iconSize: 18,
    iconMargin: 20,
  },
  L: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    iconSize: 18,
    iconMargin: 20,
  },
  XL: {
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 18,
    iconSize: 20,
    iconMargin: 22,
  },
};

export interface BannerStyles {
  fontSize: number;
  paddingVertical: number;
  paddingHorizontal: number;
  iconSize: number;
  iconMargin: number;
  errorFontSize: number;
  errorPaddingVertical: number;
}

export function useBannerStyles(): BannerStyles {
  const { screenSize } = useResponsive();
  const sizes = BANNER_SIZES[screenSize];

  return {
    fontSize: sizes.fontSize,
    paddingVertical: sizes.paddingVertical,
    paddingHorizontal: sizes.paddingHorizontal,
    iconSize: sizes.iconSize,
    iconMargin: sizes.iconMargin,
    errorFontSize: sizes.fontSize - 1,
    errorPaddingVertical: sizes.paddingVertical + 2,
  };
}
