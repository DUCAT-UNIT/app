/**
 * WalletIcons - Wallet, vault, and asset icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const WalletIcons = {
  wallet: ({ width, height, color }) => (
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

  vault: ({ width, height, color }) => (
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

  asset: ({ width, height, color }) => (
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
};
