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

  fuse: ({ width, height, color }) => (
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

  spectre: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.1438 21.2835c0.3593 -0.3608 0.8432 -0.5702 1.3522 -0.585 0.5089 -0.0148 1.0042 0.1661 1.3838 0.5054l1.9102 1.9898c0.1427 0.1288 0.3197 0.2135 0.5095 0.2438 0.1898 0.0304 0.3844 0.0051 0.5601 -0.0728 0.1758 -0.0779 0.3252 -0.205 0.4302 -0.366 0.1051 -0.161 0.1612 -0.349 0.1616 -0.5413v-12.456c0 -2.50665 -0.9957 -4.91066 -2.7682 -6.68315C16.9107 1.54576 14.5067 0.549988 12 0.549988c-2.50668 0 -4.91069 0.995772 -6.68318 2.768262 -1.77249 1.77249 -2.76827 4.1765 -2.76827 6.68315v12.4361c0.00046 0.1923 0.05659 0.3803 0.16162 0.5413 0.10504 0.161 0.25446 0.2881 0.43022 0.366 0.17575 0.0779 0.3703 0.1032 0.56013 0.0728 0.18982 -0.0303 0.36679 -0.115 0.5095 -0.2438l1.91019 -1.9898c0.37963 -0.3393 0.87488 -0.5202 1.38383 -0.5054 0.50894 0.0148 0.99285 0.2242 1.35211 0.585l1.74105 1.562c0.3728 0.3706 0.8771 0.5786 1.4028 0.5786 0.5257 0 1.03 -0.208 1.4028 -0.5786 0.587 -0.5273 1.1939 -0.9949 1.741 -1.5421Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M10.5077 10.2502c0 0.5936 -0.2359 1.163 -0.65567 1.5828 -0.4198 0.4198 -0.98917 0.6557 -1.58286 0.6557 -0.59369 0 -1.16306 -0.2359 -1.58286 -0.6557 -0.4198 -0.4198 -0.65564 -0.9892 -0.65564 -1.5828V8.75782c0 -0.59369 0.23584 -1.16306 0.65564 -1.58286 0.4198 -0.4198 0.98917 -0.65564 1.58286 -0.65564 0.59369 0 1.16306 0.23584 1.58286 0.65564 0.41977 0.4198 0.65567 0.98917 0.65567 1.58286v1.49238Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M17.9693 10.2502c0 0.5936 -0.2358 1.163 -0.6556 1.5828 -0.4198 0.4198 -0.9892 0.6557 -1.5829 0.6557 -0.5936 0 -1.163 -0.2359 -1.5828 -0.6557 -0.4198 -0.4198 -0.6557 -0.9892 -0.6557 -1.5828V8.75782c0 -0.59369 0.2359 -1.16306 0.6557 -1.58286 0.4198 -0.4198 0.9892 -0.65564 1.5828 -0.65564 0.5937 0 1.1631 0.23584 1.5829 0.65564 0.4198 0.4198 0.6556 0.98917 0.6556 1.58286v1.49238Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),
};
