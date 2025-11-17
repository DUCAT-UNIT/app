/**
 * NavIcons - Core navigation icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const NavIcons = {
  back: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5.5 17.497 -5 -5 5 -5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m0.5 12.497 23 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  settings: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m22.7891 5.50586 -13.0059 0"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.47852 5.50586 -5.26758 0"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.47852 7.47656 0 -3.9414"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.2852 13.9707 0 -3.9414"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.47852 20.4648 0 -3.9414"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.166 12H1.21094"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m22.7891 12 -6.5039 0"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m22.7891 18.4941 -13.0059 0"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.47852 18.4941 -5.26758 0"
        strokeWidth="1"
      />
    </Svg>
  ),

  transaction_history: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9.163 17.728 2.999 -3 0.001 -5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m14.158 7.228 -4 -3.5 4.5 -3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M3.707 18.729A9.837 9.837 0 1 0 10.221 3.76"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M8.08 4.419A9.827 9.827 0 0 0 5.459 6.1"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M3.708 8.159a9.4 9.4 0 0 0 -1.233 2.86"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M2.178 13.7a9.639 9.639 0 0 0 0.566 3.063"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),
};
