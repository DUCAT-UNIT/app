import { useMemo } from 'react';
import { useResponsive } from './useResponsive';

export interface ProgressStyles {
  labelFontSize: number;
  valueFontSize: number;
  iconSize: number;
}

/**
 * Hook that provides scaled styles for progress bar components
 * Based on device size scaling from Progress.stories.tsx
 *
 * Device scaling configuration:
 * - XS (320px): 0.8x
 * - S (375px): 0.9x
 * - M (390px): 0.95x
 * - L (393px): 1.0x
 * - XL (430px): 1.0x
 */
export function useProgressStyles(): ProgressStyles {
  const { scale } = useResponsive();

  return useMemo(
    () => ({
      labelFontSize: 11 * scale,
      valueFontSize: 14 * scale,
      iconSize: 12 * scale,
    }),
    [scale]
  );
}
