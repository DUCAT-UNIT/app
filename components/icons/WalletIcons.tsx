/**
 * WalletIcons - Wallet, vault, and asset icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const WalletIcons = {
  wallet: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m1.3 1.758 13.294 3.319A4.052 4.052 0 0 1 17.5 8.805v12a2.272 2.272 0 0 1 -2.92 2.312L3.424 20.493A3.985 3.985 0 0 1 0.5 16.805v-13a3.009 3.009 0 0 1 3 -3h17a3.008 3.008 0 0 1 3 3v11a3.008 3.008 0 0 1 -3 3h-3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m9.504 3.805 10 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M11.004 13.805a2 2 0 1 0 4 0 2 2 0 1 0 -4 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m17.504 8.805 2 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  vault: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.504 0.5h19s2 0 2 2v18s0 2 -2 2h-19s-2 0 -2 -2v-18s0 -2 2 -2"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m2.504 22.5 0 1"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m21.504 22.5 0 1"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M3.5 16.5v1a2 2 0 0 0 2 2h13a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-13a2 2 0 0 0 -2 2v1"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m3.504 9.5 0 4"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M2.504 6.5h2v3h-2Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M2.504 13.5h2v3h-2Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M8.004 11.5a4.5 4.5 0 1 0 9 0 4.5 4.5 0 1 0 -9 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M10.004 11.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0 -5 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m12.504 7 0 2"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m9.322 8.318 1.414 1.415"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m8.004 11.5 2 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m9.322 14.682 1.414 -1.414"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m12.504 16 0 -2"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m15.686 14.683 -1.414 -1.415"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m17.004 11.5 -2 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m15.686 8.318 -1.414 1.415"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  asset: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m1.3 1.758 13.294 3.319A4.052 4.052 0 0 1 17.5 8.805v12a2.272 2.272 0 0 1 -2.92 2.312L3.424 20.493A3.985 3.985 0 0 1 0.5 16.805v-13a3.009 3.009 0 0 1 3 -3h17a3.008 3.008 0 0 1 3 3v11a3.008 3.008 0 0 1 -3 3h-3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m9.504 3.805 10 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M11.004 13.805a2 2 0 1 0 4 0 2 2 0 1 0 -4 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m17.504 8.805 2 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  fuse: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.70538 16.7065 11.9988 22l5.2935 -5.2935"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M11.9999 22V11.6978c-0.0017 -0.8407 -0.1696 -1.6728 -0.4942 -2.44839 -0.3246 -0.77555 -0.7994 -1.47922 -1.3971 -2.07049 -0.59768 -0.59127 -1.30644 -1.05845 -2.08544 -1.37465 -0.77901 -0.3162 -1.61287 -0.47516 -2.45357 -0.46773H1.04865"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M12 11.6978c0.0016 -0.8407 0.1696 -1.6728 0.4942 -2.44839 0.3246 -0.77555 0.7994 -1.47922 1.3971 -2.07049s1.3064 -1.05845 2.0854 -1.37465c0.779 -0.3162 1.6129 -0.47516 2.4536 -0.46773h4.5241"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  turbo: ({ width, height, color = '#DDDDDD' }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        d="M14.2 5.82547c0.9 0 1.6 0.7 1.6 1.6 0 0.9 -0.7 1.6 -1.6 1.6 -0.9 0 -1.6 -0.7 -1.6 -1.6 0 -0.9 0.7 -1.6 1.6 -1.6Z"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        d="M18.7001 8.82548c1.1 -0.3 1.9 -0.99999 2.8 -1.79999 0.6 -0.6 1.7 -0.20001 1.7 0.69999 -0.1 4.20002 -2.1 5.70002 -4.5 7.00002M5.30008 8.82548c-1.1 -0.3 -1.90003 -0.99999 -2.80003 -1.79999 -0.6 -0.6 -1.700001 -0.20001 -1.700001 0.69999 0.1 4.20002 2.100021 5.70002 4.500031 7.00002m6.70002 7.2c1.8 0 2.2 -1.8 4.9 -0.4 2.7 1.3 4.9 0 4 -0.9 -0.9 -0.9 -2.2 -2.7 -2.2 -4.4l0 -7.60002c0 -3.7 -3 -6.7 -6.7 -6.7 -3.70002 0 -6.70002 3 -6.70002 6.7l0 7.60002c0 1.8 -1.30001 3.6 -2.20001 4.4 -0.9 0.8 1.3 2.2 4 0.9 2.7 -1.3 3.10003 0.4 4.90003 0.4Z"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        d="M8.5 11.7255s1 0.5 3.4 0.5 3.4 -0.5 3.4 -0.5"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        d="M14.1 12.0625v2.0776c0 1.2466 -1 2.2854 -2.2 2.2854 -1.2 0 -2.19999 -1.0388 -2.19999 -2.2854v-2.0776"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.19995 8.24374c-0.20711 0 -0.375 -0.16789 -0.375 -0.375 0 -0.2071 0.16789 -0.375 0.375 -0.375"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.19995 8.24374c0.20711 0 0.375 -0.16789 0.375 -0.375 0 -0.2071 -0.16789 -0.375 -0.375 -0.375"
        strokeWidth="1"
      />
    </Svg>
  ),
};
