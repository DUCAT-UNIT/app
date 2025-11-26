/**
 * StatusIcons - Status and feedback icons
 */

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

export const StatusIcons = {
  done: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <G>
        <Path
          d="m18 7 -6.38 8.66a1 1 0 0 1 -0.68 0.4 1 1 0 0 1 -0.75 -0.21L6 12.5"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
        <Path
          d="M0.5 12a11.5 11.5 0 1 0 23 0 11.5 11.5 0 1 0 -23 0"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
      </G>
    </Svg>
  ),

  warning: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23674 20.5467 2.53773 20.7239C2.83872 20.9012 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9012 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3438 2.89725 12 2.89725C11.6562 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  party: ({ width, height, color }: { width?: number; height?: number; color?: string }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.483 12.216a4.967 4.967 0 0 1 7.017 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M11.768 7.518a4.961 4.961 0 0 0 0 -7.018"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m18.075 8.249 3.509 -1.168"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m15.736 5.912 1.17 -3.51"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M7.965 4.771a0.25 0.25 0 0 1 0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M7.715 5.021a0.25 0.25 0 0 1 0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M7.965 5.271a0.25 0.25 0 0 1 -0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M8.215 5.021a0.25 0.25 0 0 1 -0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M15.465 7.771a0.25 0.25 0 0 1 0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M15.215 8.021a0.25 0.25 0 0 1 0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M15.465 8.271a0.25 0.25 0 0 1 -0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M15.715 8.021a0.25 0.25 0 0 1 -0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.465 13.771a0.25 0.25 0 0 1 0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.215 14.021a0.25 0.25 0 0 1 0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.465 14.271a0.25 0.25 0 0 1 -0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.715 14.021a0.25 0.25 0 0 1 -0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.965 3.771a0.25 0.25 0 0 1 0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.715 4.021a0.25 0.25 0 0 1 0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M19.965 4.271a0.25 0.25 0 0 1 -0.25 -0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M20.215 4.021a0.25 0.25 0 0 1 -0.25 0.25"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M9.7337957955 14.266045307a5.5 2.5 45 1 0 3.535533906 -3.5355339059 5.5 2.5 45 1 0 -3.535533906 3.535533906Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M15.145 16.575 2.484 23.341A1.348 1.348 0 0 1 0.66 21.516L7.425 8.855"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),
};
