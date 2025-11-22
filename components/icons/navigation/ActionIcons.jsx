/**
 * ActionIcons - Wallet action icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const ActionIcons = {
  send: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m6.5 5.497 5 -5 5 5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m11.5 0.497 0 23"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  receive: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m16.5 18.497 -5 5 -5 -5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m11.5 23.497 0 -23"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  close: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <Path
        d="M6 6L18 18"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </Svg>
  ),
};
