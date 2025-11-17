/**
 * PrivacyIcons - Privacy and visibility icons
 */

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

export const PrivacyIcons = {
  privacy_on: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <G>
        <Path
          d="M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0 -7 0"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
        <Path
          d="M23.38 11.67C22.21 10.35 17.56 5.5 12 5.5S1.79 10.35 0.62 11.67a0.52 0.52 0 0 0 0 0.66C1.79 13.65 6.44 18.5 12 18.5s10.21 -4.85 11.38 -6.17a0.52 0.52 0 0 0 0 -0.66Z"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
      </G>
    </Svg>
  ),

  privacy_off: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5035 8.29321C20.9851 9.35723 22.3277 10.6025 23.5 12c0 0 -5.1655 6.4943 -11.51 6.4943 -1.0183 -0.0177 -2.02837 -0.186 -2.99739 -0.4995"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.83449 17.1555C4.41203 15.859 2.26149 14.1087 0.5 12c0 0 5.14553 -6.49432 11.49 -6.49432 1.7997 0.03591 3.5657 0.49453 5.1555 1.33883"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.9865 12c0 1.0599 -0.421 2.0765 -1.1705 2.826 -0.7495 0.7495 -1.7661 1.1705 -2.826 1.1705"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.7315 2.25848 2.24847 21.7415"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.16248 14.8276c-0.74991 -0.7499 -1.17121 -1.767 -1.17121 -2.8276 0 -1.0605 0.4213 -2.0776 1.17121 -2.82751 0.74991 -0.74991 1.76702 -1.17121 2.82752 -1.17121 1.0606 0 2.0776 0.4213 2.8276 1.17121"
        strokeWidth="1"
      />
    </Svg>
  ),
};
