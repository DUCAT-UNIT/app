// Mock for react-native-reanimated
import { View, ViewProps } from 'react-native';

export const useSharedValue = <T>(initialValue: T) => ({ value: initialValue });
export const useAnimatedStyle = () => ({});
export const useDerivedValue = <T>(fn: () => T) => ({ value: fn() });
export const useAnimatedGestureHandler = () => ({});
export const withSpring = (toValue: number) => toValue;
export const withTiming = (toValue: number) => toValue;
export const withDelay = (_: number, animation: number) => animation;
export const withSequence = (...animations: number[]) => animations[0];
export const withRepeat = (animation: number) => animation;
export const cancelAnimation = () => {};
export const runOnJS = <T extends (...args: unknown[]) => unknown>(fn: T) => fn;
export const runOnUI = <T extends (...args: unknown[]) => unknown>(fn: T) => fn;
export const interpolate = (value: number, inputRange: number[], outputRange: number[]) => {
  const clampedValue = Math.max(inputRange[0], Math.min(inputRange[inputRange.length - 1], value));
  const inputIndex = inputRange.findIndex((v, i) => clampedValue >= v && (i === inputRange.length - 1 || clampedValue < inputRange[i + 1]));
  const inputStart = inputRange[inputIndex];
  const inputEnd = inputRange[Math.min(inputIndex + 1, inputRange.length - 1)];
  const outputStart = outputRange[inputIndex];
  const outputEnd = outputRange[Math.min(inputIndex + 1, outputRange.length - 1)];
  if (inputEnd === inputStart) return outputStart;
  return outputStart + ((clampedValue - inputStart) / (inputEnd - inputStart)) * (outputEnd - outputStart);
};
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  bezier: () => (t: number) => t,
  in: (easing: (t: number) => number) => easing,
  out: (easing: (t: number) => number) => easing,
  inOut: (easing: (t: number) => number) => easing,
};

const createAnimatedComponent = <T extends React.ComponentType<ViewProps>>(Component: T) => Component;

const Animated = {
  View,
  Text: View,
  Image: View,
  ScrollView: View,
  FlatList: View,
  createAnimatedComponent,
};

export default Animated;
