/**
 * RecoveryIcons - Wallet recovery and backup icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const RecoveryIcons = {
  recovery_phrase: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m20.5 0.5 -9.782 9.783a7 7 0 1 0 3 3L17 10h1.5V8.5L19 8h1.5V6.5L21 6h1.5V4.5l1 -1v-3Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),
};
