import { useContext } from 'react';
import { ResponsiveContext } from '../contexts/ResponsiveContext';
import { ScreenSize } from '../styles/responsive';

export interface UseResponsiveReturn {
  width: number;
  height: number;
  screenSize: ScreenSize;
  scale: number;
  s: (value: number) => number;
  sf: (value: number, min?: number) => number;
}

export function useResponsive(): UseResponsiveReturn {
  const context = useContext(ResponsiveContext);

  if (!context) {
    throw new Error('useResponsive must be used within a ResponsiveProvider');
  }

  const { width, height, screenSize, scale } = context;

  const s = (value: number): number => {
    return Math.round(value * scale);
  };

  const sf = (value: number, min: number = 10): number => {
    const scaled = value * scale;
    return Math.max(Math.round(scaled), min);
  };

  return {
    width,
    height,
    screenSize,
    scale,
    s,
    sf,
  };
}
