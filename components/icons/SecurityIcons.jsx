/**
 * SecurityIcons - Security and authentication icons
 */

import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

export const SecurityIcons = {
  pin: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.5 10.5c0 -0.2652 -0.1054 -0.51957 -0.2929 -0.70711C20.0196 9.60536 19.7652 9.5 19.5 9.5h-15c-0.26522 0 -0.51957 0.10536 -0.70711 0.29289C3.60536 9.98043 3.5 10.2348 3.5 10.5v12c0 0.2652 0.10536 0.5196 0.29289 0.7071 0.18754 0.1875 0.44189 0.2929 0.70711 0.2929h15c0.2652 0 0.5196 -0.1054 0.7071 -0.2929s0.2929 -0.4419 0.2929 -0.7071v-12Z"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 6c0 -1.45869 0.57946 -2.85764 1.61091 -3.88909S10.5413 0.5 12 0.5c1.4587 0 2.8576 0.57946 3.8891 1.61091C16.9205 3.14236 17.5 4.54131 17.5 6v3.5h-11V6Z"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M8.5 13.5c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M8.5 13.5c0.13807 0 0.25 -0.1119 0.25 -0.25S8.63807 13 8.5 13"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M12 13.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M12 13.5c0.1381 0 0.25 -0.1119 0.25 -0.25S12.1381 13 12 13"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M15.5 13.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M15.5 13.5c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M8.5 17c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M8.5 17c0.13807 0 0.25 -0.1119 0.25 -0.25s-0.11193 -0.25 -0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M8.5 20.5c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        d="M8.5 20.5c0.13807 0 0.25 -0.1119 0.25 -0.25S8.63807 20 8.5 20"
        strokeWidth="1"
      />
      <G>
        <Path
          stroke={color}
          d="M12 17c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
          strokeWidth="1"
        />
        <Path
          stroke={color}
          d="M12 17c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25"
          strokeWidth="1"
        />
      </G>
      <G>
        <Path
          stroke={color}
          d="M12 20.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
          strokeWidth="1"
        />
        <Path
          stroke={color}
          d="M12 20.5c0.1381 0 0.25 -0.1119 0.25 -0.25S12.1381 20 12 20"
          strokeWidth="1"
        />
      </G>
      <G>
        <Path
          stroke={color}
          d="M15.5 17c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
          strokeWidth="1"
        />
        <Path
          stroke={color}
          d="M15.5 17c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25"
          strokeWidth="1"
        />
      </G>
      <G>
        <Path
          stroke={color}
          d="M15.5 20.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
          strokeWidth="1"
        />
        <Path
          stroke={color}
          d="M15.5 20.5c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25"
          strokeWidth="1"
        />
      </G>
    </Svg>
  ),

  recovery_phrase: ({ width, height, color }) => (
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

  switch_account: ({ width, height, color }) => (
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

  logout: ({ width, height, color }) => (
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

  delete_wallet: ({ width, height, color }) => (
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

  face_id: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M0.5 6.5v-3a3 3 0 0 1 3 -3h3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M23.5 6.5v-3a3 3 0 0 0 -3 -3h-3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M0.5 17.5v3a3 3 0 0 0 3 3h3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M23.5 17.5v3a3 3 0 0 1 -3 3h-3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M12.5 8v4.5A1.5 1.5 0 0 1 11 14h-0.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m7.5 8 0 2.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m17.5 8 0 2.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M8.233 17a5.48 5.48 0 0 0 7.534 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),
};
