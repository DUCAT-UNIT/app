// Mock for react-native-gesture-handler
import React from 'react';
import { View, TouchableOpacity, ScrollView as RNScrollView, FlatList as RNFlatList } from 'react-native';

export const GestureHandlerRootView = View;
export const PanGestureHandler = View;
export const TapGestureHandler = View;
export const LongPressGestureHandler = View;
export const RotationGestureHandler = View;
export const PinchGestureHandler = View;
export const FlingGestureHandler = View;
export const ForceTouchGestureHandler = View;
export const NativeViewGestureHandler = View;

export const ScrollView = RNScrollView;
export const FlatList = RNFlatList;
export const Switch = View;
export const TextInput = View;
export const DrawerLayout = View;

export const TouchableHighlight = TouchableOpacity;
export const TouchableNativeFeedback = TouchableOpacity;
export const TouchableWithoutFeedback = TouchableOpacity;
export const TouchableOpacity = TouchableOpacity;
export const RectButton = TouchableOpacity;
export const BorderlessButton = TouchableOpacity;
export const BaseButton = TouchableOpacity;

export const Gesture = {
  Pan: () => ({
    onStart: () => Gesture.Pan(),
    onUpdate: () => Gesture.Pan(),
    onEnd: () => Gesture.Pan(),
    enabled: () => Gesture.Pan(),
    minDistance: () => Gesture.Pan(),
    activeOffsetX: () => Gesture.Pan(),
    activeOffsetY: () => Gesture.Pan(),
  }),
  Tap: () => ({
    onStart: () => Gesture.Tap(),
    onEnd: () => Gesture.Tap(),
    numberOfTaps: () => Gesture.Tap(),
  }),
  LongPress: () => ({
    onStart: () => Gesture.LongPress(),
    onEnd: () => Gesture.LongPress(),
    minDuration: () => Gesture.LongPress(),
  }),
  Simultaneous: (..._gestures: unknown[]) => ({}),
  Exclusive: (..._gestures: unknown[]) => ({}),
  Race: (..._gestures: unknown[]) => ({}),
};

export const GestureDetector = ({ children }: { children: React.ReactNode }) => children;
export const gestureHandlerRootHOC = <T extends React.ComponentType>(Component: T) => Component;

export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

export const Directions = {
  RIGHT: 1,
  LEFT: 2,
  UP: 4,
  DOWN: 8,
};

export default {
  GestureHandlerRootView,
  PanGestureHandler,
  TapGestureHandler,
  ScrollView,
  FlatList,
  Gesture,
  GestureDetector,
  State,
  Directions,
};
