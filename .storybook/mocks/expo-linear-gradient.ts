// Mock for expo-linear-gradient
import React from 'react';
import { View, ViewStyle } from 'react-native';

interface LinearGradientProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const LinearGradient = ({ colors, style, children }: LinearGradientProps) =>
  React.createElement(View, {
    style: [style, { backgroundColor: colors[0] || 'transparent' }]
  }, children);

export default LinearGradient;
