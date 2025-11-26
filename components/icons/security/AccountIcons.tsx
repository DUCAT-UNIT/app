/**
 * AccountIcons - Account management icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const AccountIcons = {
  switch_account: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.366 20.433a3.067 3.067 0 1 0 6.134 0 3.067 3.067 0 1 0 -6.134 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M20.433 17.367V8.678a5.111 5.111 0 0 0 -5.111 -5.111h-4.089"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m14.3 0.5 -3.067 3.067L14.3 6.633"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M0.5 3.567a3.067 3.067 0 1 0 6.134 0 3.067 3.067 0 1 0 -6.134 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M3.567 6.633v8.689a5.111 5.111 0 0 0 5.111 5.111h4.089"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m9.7 23.5 3.067 -3.067L9.7 17.367"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  logout: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m23.5 12 -12 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m19.5 16 4 -4 -4 -4"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M9.5 2.5H17a0.5 0.5 0 0 1 0.5 0.5v2.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M17.5 18.5V21a0.5 0.5 0 0 1 -0.5 0.5H9.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M0.5 21.223a0.5 0.5 0 0 0 0.392 0.488l8 1.777A0.5 0.5 0 0 0 9.5 23V1a0.5 0.5 0 0 0 -0.608 -0.488l-8 1.778a0.5 0.5 0 0 0 -0.392 0.488Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M4.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  delete_wallet: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.5 23.5v-5a5 5 0 0 0 5 -5V11a10.5 10.5 0 0 0 -21 0v2.5a5 5 0 0 0 5 5v5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M6.441 4.5c0 2.734 -1.636 4 -3.441 4H1.8"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M4 12.5a3 3 0 1 0 6 0 3 3 0 1 0 -6 0Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M17.559 4.5c0 2.734 1.636 4 3.441 4h1.2"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M14 12.5a3 3 0 1 0 6 0 3 3 0 1 0 -6 0Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m11 16 0.276 -0.553a0.81 0.81 0 0 1 1.448 0L13 16"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m10 18.5 0 5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m14 18.5 0 5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),
};
