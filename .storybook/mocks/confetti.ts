// Mock for react-native-confetti-cannon
import React from 'react';
import { View } from 'react-native';

interface ConfettiCannonProps {
  count?: number;
  origin?: { x: number; y: number };
  explosionSpeed?: number;
  fallSpeed?: number;
  fadeOut?: boolean;
  colors?: string[];
  autoStart?: boolean;
  autoStartDelay?: number;
  onAnimationStart?: () => void;
  onAnimationEnd?: () => void;
}

const ConfettiCannon = React.forwardRef<unknown, ConfettiCannonProps>((_props, _ref) =>
  React.createElement(View, { style: { position: 'absolute', width: 0, height: 0 } })
);

ConfettiCannon.displayName = 'ConfettiCannon';

export default ConfettiCannon;
