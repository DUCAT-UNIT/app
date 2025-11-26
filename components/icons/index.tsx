/**
 * Icon Component - Barrel Export
 * Unified icon system combining all icon categories
 */

import React from 'react';
import { StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { NavigationIcons } from './NavigationIcons';
import { WalletIcons } from './WalletIcons';
import { SecurityIcons } from './SecurityIcons';
import { BrandIcons } from './BrandIcons';
import { UIIcons } from './UIIcons';

export interface SVGIconProps {
  width?: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  testID?: string;
}

// Combine all icon categories into a single object
const IconComponents: Record<string, React.ComponentType<SVGIconProps>> = {
  ...NavigationIcons,
  ...WalletIcons,
  ...SecurityIcons,
  ...BrandIcons,
  ...UIIcons,
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  testID?: string;
}

/**
 * Icon component
 * @param name - Icon name (e.g., 'back', 'send', 'receive')
 * @param size - Icon size (default: 24)
 * @param color - Icon color (default: '#DDDDDD')
 * @param style - Additional styles
 */
const Icon = React.memo(function Icon({ name, size = 24, color = '#DDDDDD', style, testID }: IconProps) {
  const IconComponent = IconComponents[name];

  if (!IconComponent) {
    return null;
  }

  return <IconComponent width={size} height={size} color={color} style={style} testID={testID} />;
});

export default Icon;

// Also export individual categories for direct access if needed
export { NavigationIcons, WalletIcons, SecurityIcons, BrandIcons, UIIcons };
