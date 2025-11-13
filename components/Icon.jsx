/**
 * Icon Component
 * Unified icon system using actual SVG files from assets/icons
 */

import React from 'react';
import PropTypes from 'prop-types';
import Svg, { Path, G } from 'react-native-svg';

// Icon components - using actual SVG paths from provided icon files
const IconComponents = {
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

  copy: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.4999 5.5V1.50049c0 -0.552286 -0.4477 -1.000002 -1 -1.000002H1.49988C0.947593 0.500488 0.499878 0.948203 0.499878 1.50049V15.5005c0 0.5523 0.447715 1 1.000002 1H5.5"
        strokeWidth="1"
      />
      <Path
        stroke={color}
        strokeLinejoin="round"
        d="M7.4999 8.49951c0 -0.55228 0.44772 -1 1 -1h14c0.5523 0 1 0.44772 1 1V22.4995c0 0.5523 -0.4477 1 -1 1h-14c-0.55228 0 -1 -0.4477 -1 -1V8.49951Z"
        strokeWidth="1"
      />
    </Svg>
  ),

  paste: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.5 21.5h-8a1 1 0 0 1 -1 -1v-16a1 1 0 0 1 1 -1h2"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M13.5 3.5h2a1 1 0 0 1 1 1V8"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M7 1.999a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M9.915 2.5H12.5a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h2.585"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M22.5 22.5a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1V11a1 1 0 0 1 1 -1h7.086a1 1 0 0 1 0.707 0.293l1.914 1.914a1 1 0 0 1 0.293 0.707Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m14.5 14.499 5 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m14.5 17.499 5 0"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
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

  delete: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.284 3.5h14.049a1 1 0 0 1 1 1v15a1 1 0 0 1 -1 1H8.284a1 1 0 0 1 -0.75 -0.338l-6.617 -7.5a1 1 0 0 1 0 -1.324l6.617 -7.5a1 1 0 0 1 0.75 -0.338Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m10.833 8 8 8"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="m18.833 8 -8 8"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  done: ({ width, height, color }) => (
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

  notification: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 12.5v8c0 0.7956 -0.3161 1.5587 -0.8787 2.1213 -0.5626 0.5626 -1.3257 0.8787 -2.1213 0.8787h-14c-0.79565 0 -1.55871 -0.3161 -2.12132 -0.8787C0.81607 22.0587 0.5 21.2956 0.5 20.5v-14c0 -0.79565 0.31607 -1.55871 0.87868 -2.12132C1.94129 3.81607 2.70435 3.5 3.5 3.5h8"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M18.5 10.5c2.7614 0 5 -2.23858 5 -5s-2.2386 -5 -5 -5 -5 2.23858 -5 5 2.2386 5 5 5Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <Path
        d="M18.5 8.25c-0.1381 0 -0.25 -0.11193 -0.25 -0.25s0.1119 -0.25 0.25 -0.25"
        fill="none"
        stroke={color}
        strokeWidth="1"
      />
      <Path
        d="M18.5 8.25c0.1381 0 0.25 -0.11193 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25"
        fill="none"
        stroke={color}
        strokeWidth="1"
      />
      <Path
        d="M18.5 5.75v-3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  // Logo icons from assets/logos/
  unit_logo: ({ width, height }) => (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16Z"
        fill="#1858E4"
      />
      <Path
        d="M6.02734 4.80762V8.68945C6.02162 9.27303 6.1317 9.75017 6.38867 10.0908L6.39062 10.0928C6.50057 10.2357 6.65728 10.4417 6.9082 10.6074C7.16337 10.7758 7.50469 10.8955 7.97656 10.8955C8.87309 10.8953 9.35464 10.4026 9.59375 10.0918C9.82429 9.7935 9.94045 9.3909 9.96191 8.90332L9.96582 8.68945V4.80762H10.668V6.4541H12.041V7.02441H10.668V8.18262H12.041V8.75293L10.6719 8.75293L10.6602 8.93555C10.607 9.80234 10.349 10.4345 9.90918 10.8594C9.47083 11.2828 8.83608 11.5077 7.97656 11.5078C7.11682 11.5078 6.4814 11.2829 6.04297 10.8594C5.60315 10.4345 5.34517 9.80232 5.29199 8.93555L5.28027 8.75293H3.95996V8.18262H5.28418V7.02441H3.95996V6.4541H5.28418V4.80762L6.02734 4.80762Z"
        fill="white"
        stroke="white"
        strokeWidth="0.389598"
      />
    </Svg>
  ),

  btc_logo: ({ width, height }) => (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16Z"
        fill="#F7931A"
      />
      <Path
        d="M11.5941 7.01C11.7511 5.962 10.9526 5.3985 9.86163 5.0225L10.2156 3.6025L9.35163 3.3875L9.00663 4.77C8.77963 4.713 8.54663 4.66 8.31413 4.607L8.66162 3.2155L7.79763 3L7.44362 4.4195C7.25562 4.3765 7.07063 4.3345 6.89163 4.2895L6.89263 4.285L5.70063 3.9875L5.47063 4.9105C5.47063 4.9105 6.11213 5.0575 6.09863 5.0665C6.44863 5.154 6.51163 5.3855 6.50113 5.5695L6.09812 7.187C6.12212 7.193 6.15313 7.202 6.18813 7.2155L6.09663 7.193L5.53163 9.459C5.48863 9.565 5.38013 9.7245 5.13513 9.664C5.14413 9.6765 4.50713 9.5075 4.50713 9.5075L4.07812 10.4965L5.20312 10.777C5.41213 10.8295 5.61712 10.8845 5.81862 10.936L5.46113 12.372L6.32463 12.587L6.67863 11.167C6.91463 11.2305 7.14363 11.2895 7.36763 11.3455L7.01463 12.7595L7.87863 12.9745L8.23612 11.5415C9.71012 11.8205 10.8181 11.708 11.2846 10.375C11.6606 9.302 11.2661 8.6825 10.4906 8.279C11.0556 8.149 11.4806 7.7775 11.5941 7.01ZM9.61913 9.779C9.35263 10.8525 7.54513 10.272 6.95913 10.1265L7.43413 8.224C8.02013 8.3705 9.89863 8.66 9.61913 9.779ZM9.88663 6.9945C9.64313 7.971 8.13913 7.4745 7.65163 7.353L8.08162 5.628C8.56912 5.7495 10.1406 5.976 9.88663 6.9945Z"
        fill="white"
      />
    </Svg>
  ),

  ducat_logo: ({ width, height }) => (
    <Svg width={width} height={height} viewBox="0 0 67 67" fill="none">
      <Path
        d="M33.4998 66.3277C51.6304 66.3277 66.3282 51.6299 66.3282 33.4993C66.3282 15.3687 51.6304 0.670898 33.4998 0.670898C15.3692 0.670898 0.671387 15.3687 0.671387 33.4993C0.671387 51.6299 15.3692 66.3277 33.4998 66.3277Z"
        stroke="#DDDDDD"
        strokeWidth="1.3424"
        strokeMiterlimit="10"
        fill="none"
      />
      <Path
        d="M33.4762 35.9534C34.6887 35.9534 35.6717 34.9705 35.6717 33.758C35.6717 32.5454 34.6887 31.5625 33.4762 31.5625C32.2637 31.5625 31.2808 32.5454 31.2808 33.758C31.2808 34.9705 32.2637 35.9534 33.4762 35.9534Z"
        fill="#DDDDDD"
      />
    </Svg>
  ),

  btc_symbol: ({ width, height, color = '#DDDDDD' }) => (
    <Svg width={width} height={height} viewBox="0 0 8 10" fill="none">
      <Path
        d="M7.516 4.01C7.673 2.962 6.8745 2.3985 5.7835 2.0225L6.1375 0.6025L5.2735 0.3875L4.9285 1.77C4.7015 1.713 4.4685 1.66 4.236 1.607L4.5835 0.2155L3.7195 0L3.3655 1.4195C3.1775 1.3765 2.9925 1.3345 2.8135 1.2895L2.8145 1.285L1.6225 0.9875L1.3925 1.9105C1.3925 1.9105 2.034 2.0575 2.0205 2.0665C2.3705 2.154 2.4335 2.3855 2.423 2.5695L2.02 4.187C2.044 4.193 2.075 4.202 2.11 4.2155L2.0185 4.193L1.4535 6.459C1.4105 6.565 1.302 6.7245 1.057 6.664C1.066 6.6765 0.429 6.5075 0.429 6.5075L0 7.4965L1.125 7.777C1.334 7.8295 1.539 7.8845 1.7405 7.936L1.383 9.372L2.2465 9.587L2.6005 8.167C2.8365 8.2305 3.0655 8.2895 3.2895 8.3455L2.9365 9.7595L3.8005 9.9745L4.158 8.5415C5.632 8.8205 6.74 8.708 7.2065 7.375C7.5825 6.302 7.188 5.6825 6.4125 5.279C6.9775 5.149 7.4025 4.7775 7.516 4.01ZM5.541 6.779C5.2745 7.8525 3.467 7.272 2.881 7.1265L3.356 5.224C3.942 5.3705 5.8205 5.66 5.541 6.779ZM5.8085 3.9945C5.565 4.971 4.061 4.4745 3.5735 4.353L4.0035 2.628C4.491 2.7495 6.0625 2.976 5.8085 3.9945Z"
        fill={color}
      />
    </Svg>
  ),

  unit_symbol: ({ width, height, color = '#DDDDDD' }) => (
    <Svg width={width} height={height} viewBox="0 0 9 8" fill="none">
      <Path
        d="M1.51884 1.84096C1.51884 1.76927 1.51884 1.49354 1.51884 1.01376L1.51884 0.194824L2.65164 0.194824L2.65164 4.27295C2.64612 4.83545 2.75366 5.26284 2.97425 5.55512C3.19484 5.84188 3.5332 6.28257 4.40579 6.28257C5.21737 6.28257 5.64897 5.84188 5.86955 5.55512C6.09566 5.26284 6.20595 4.83545 6.20044 4.27295L6.20044 0.194824L7.29274 0.194824V1.84096L8.6659 1.84096V2.80052L7.29274 2.80052L7.29274 3.56982L8.6659 3.56982V4.52938L7.28447 4.52938C7.22932 5.42828 6.9591 6.1121 6.47381 6.58085C5.98851 7.0496 5.29917 7.28398 4.40579 7.28398C3.51241 7.28398 2.82307 7.0496 2.33778 6.58085C1.85248 6.1121 1.58226 5.42828 1.52711 4.52938H0.195312L0.195312 3.56982L1.51884 3.56982V2.80052L0.195312 2.80052L0.195312 1.84096L1.51884 1.84096Z"
        fill={color}
        stroke={color}
        strokeWidth="0.389598"
      />
    </Svg>
  ),

  vault_logo: ({ width, height, color = '#DDDDDD' }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <G>
        <Path
          d="M16.6829 6H7.31707C6.59109 6 6 6.59109 6 7.31707V16.6829C6 17.4089 6.59109 18 7.31707 18H16.6829C17.4089 18 18 17.4089 18 16.6829V7.31707C18 6.59109 17.4089 6 16.6829 6ZM17.1 16.2C17.1045 16.729 16.792 17.0834 16.2 17.1H7.8C7.16424 17.1474 6.86501 16.7749 6.9 16.2V7.8C6.91941 7.18715 7.21187 6.89204 7.8 6.9H16.2C16.8532 6.86779 17.1448 7.20988 17.1 7.8V16.2Z"
          fill={color}
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.3013 9.13864C10.4861 8.95379 10.7858 8.95379 10.9707 9.13864L11.8553 10.0232C12.2294 9.77543 12.6781 9.63112 13.1605 9.63112C13.6428 9.63112 14.0915 9.77543 14.4656 10.0232L15.3503 9.13864C15.5351 8.95379 15.8348 8.95379 16.0197 9.13864C16.2045 9.32349 16.2045 9.62319 16.0197 9.80804L15.1351 10.6926C15.3828 11.0668 15.5272 11.5155 15.5272 11.9978C15.5272 12.4802 15.3828 12.9289 15.1351 13.303L16.0197 14.1876C16.2045 14.3725 16.2045 14.6722 16.0197 14.857C15.8348 15.0419 15.5351 15.0419 15.3503 14.857L14.4656 13.9724C14.0915 14.2202 13.6428 14.3645 13.1605 14.3645C12.6781 14.3645 12.2294 14.2202 11.8553 13.9724L10.9707 14.857C10.7858 15.0419 10.4861 15.0419 10.3013 14.857C10.1164 14.6722 10.1164 14.3725 10.3013 14.1876L11.1859 13.303C10.9381 12.9289 10.7938 12.4802 10.7938 11.9978C10.7938 11.5155 10.9381 11.0668 11.1859 10.6926L10.3013 9.80804C10.1164 9.62319 10.1164 9.32349 10.3013 9.13864ZM11.7405 11.9978C11.7405 11.2136 12.3762 10.5778 13.1605 10.5778C13.9447 10.5778 14.5805 11.2136 14.5805 11.9978C14.5805 12.7821 13.9447 13.4179 13.1605 13.4179C12.3762 13.4179 11.7405 12.7821 11.7405 11.9978Z"
          fill={color}
        />
        <Path
          d="M8.91412 8.87334C8.91412 8.61192 8.70219 8.4 8.44077 8.4C8.17936 8.4 7.96743 8.61192 7.96743 8.87334V15.1846C7.96743 15.446 8.17936 15.6579 8.44077 15.6579C8.70219 15.6579 8.91412 15.446 8.91412 15.1846V8.87334Z"
          fill={color}
        />
      </G>
    </Svg>
  ),

  qr_code: ({ width, height, color = '#DDDDDD' }) => (
    <Svg width={width} height={height} viewBox="0 0 640 640">
      <Path
        d="M160 224L224 224L224 160L160 160L160 224zM96 144C96 117.5 117.5 96 144 96L240 96C266.5 96 288 117.5 288 144L288 240C288 266.5 266.5 288 240 288L144 288C117.5 288 96 266.5 96 240L96 144zM160 480L224 480L224 416L160 416L160 480zM96 400C96 373.5 117.5 352 144 352L240 352C266.5 352 288 373.5 288 400L288 496C288 522.5 266.5 544 240 544L144 544C117.5 544 96 522.5 96 496L96 400zM416 160L416 224L480 224L480 160L416 160zM400 96L496 96C522.5 96 544 117.5 544 144L544 240C544 266.5 522.5 288 496 288L400 288C373.5 288 352 266.5 352 240L352 144C352 117.5 373.5 96 400 96zM384 416C366.3 416 352 401.7 352 384C352 366.3 366.3 352 384 352C401.7 352 416 366.3 416 384C416 401.7 401.7 416 384 416zM384 480C401.7 480 416 494.3 416 512C416 529.7 401.7 544 384 544C366.3 544 352 529.7 352 512C352 494.3 366.3 480 384 480zM480 512C480 494.3 494.3 480 512 480C529.7 480 544 494.3 544 512C544 529.7 529.7 544 512 544C494.3 544 480 529.7 480 512zM512 416C494.3 416 480 401.7 480 384C480 366.3 494.3 352 512 352C529.7 352 544 366.3 544 384C544 401.7 529.7 416 512 416zM480 448C480 465.7 465.7 480 448 480C430.3 480 416 465.7 416 448C416 430.3 430.3 416 448 416C465.7 416 480 430.3 480 448z"
        fill={color}
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

  warning: ({ width, height, color }) => (
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

  chevron_down: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m6 9 6 6 6 -6"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  chevron_up: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="m18 15 -6 -6 -6 6"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </Svg>
  ),

  party: ({ width, height, color }) => (
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

/**
 * Icon component
 * @param {string} name - Icon name (e.g., 'back', 'send', 'receive')
 * @param {number} size - Icon size (default: 24)
 * @param {string} color - Icon color (default: '#DDDDDD')
 * @param {object} style - Additional styles
 */
const Icon = React.memo(function Icon({ name, size = 24, color = '#DDDDDD', style }) {
  const IconComponent = IconComponents[name];

  if (!IconComponent) {
    return null;
  }

  return <IconComponent width={size} height={size} color={color} style={style} />;
});

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.number,
  color: PropTypes.string,
  style: PropTypes.object,
};

export default Icon;
