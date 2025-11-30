import { Dimensions } from 'react-native';

export type ScreenSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export interface DeviceConfig {
  width: number;
  size: ScreenSize;
  label: string;
  scale: number;
}

export const DEVICE_CONFIGS: DeviceConfig[] = [
  { width: 320, size: 'XS', label: 'iPhone SE', scale: 0.75 },
  { width: 375, size: 'S', label: 'iPhone 8', scale: 0.85 },
  { width: 390, size: 'M', label: 'iPhone 14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 14 Pro Max', scale: 1.1 },
];

export function getDeviceConfig(width: number): DeviceConfig {
  if (width <= 340) return DEVICE_CONFIGS[0];
  if (width <= 382) return DEVICE_CONFIGS[1];
  if (width <= 391) return DEVICE_CONFIGS[2];
  if (width <= 410) return DEVICE_CONFIGS[3];
  return DEVICE_CONFIGS[4];
}

export function getScreenSize(width: number): ScreenSize {
  return getDeviceConfig(width).size;
}

export function getScale(width: number): number {
  return getDeviceConfig(width).scale;
}
