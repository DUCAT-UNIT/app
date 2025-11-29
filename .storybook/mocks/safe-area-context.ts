// Mock for react-native-safe-area-context
import React from 'react';
import { View } from 'react-native';

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(View, { style: { flex: 1 } }, children);
};

export const SafeAreaView = ({ children, style, ...props }: any) => {
  return React.createElement(View, { style: [{ flex: 1 }, style], ...props }, children);
};

export const useSafeAreaInsets = () => ({
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
});

export const useSafeAreaFrame = () => ({
  x: 0,
  y: 0,
  width: 393,
  height: 852,
});

export const SafeAreaInsetsContext = React.createContext({
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
});

export const SafeAreaFrameContext = React.createContext({
  x: 0,
  y: 0,
  width: 393,
  height: 852,
});

export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
};

export const withSafeAreaInsets = (Component: any) => Component;

export default {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
  useSafeAreaFrame,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
  initialWindowMetrics,
  withSafeAreaInsets,
};
