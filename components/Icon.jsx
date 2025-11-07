/**
 * Icon Component
 * Unified icon system using actual SVG files from assets/icons
 */

import React from 'react';
import PropTypes from 'prop-types';
import Svg, { Path, G, Circle } from 'react-native-svg';

// Icon components - using actual SVG paths from provided icon files
const IconComponents = {
  back: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="m5.5 17.497 -5 -5 5 -5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m0.5 12.497 23 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  send: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="m6.5 5.497 5 -5 5 5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m11.5 0.497 0 23" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  receive: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="m16.5 18.497 -5 5 -5 -5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m11.5 23.497 0 -23" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  settings: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m22.7891 5.50586 -13.0059 0" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m6.47852 5.50586 -5.26758 0" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m6.47852 7.47656 0 -3.9414" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m16.2852 13.9707 0 -3.9414" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m6.47852 20.4648 0 -3.9414" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M13.166 12H1.21094" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m22.7891 12 -6.5039 0" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m22.7891 18.4941 -13.0059 0" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="m6.47852 18.4941 -5.26758 0" strokeWidth="1" />
    </Svg>
  ),

  transaction_history: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="m9.163 17.728 2.999 -3 0.001 -5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m14.158 7.228 -4 -3.5 4.5 -3" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M3.707 18.729A9.837 9.837 0 1 0 10.221 3.76" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M8.08 4.419A9.827 9.827 0 0 0 5.459 6.1" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M3.708 8.159a9.4 9.4 0 0 0 -1.233 2.86" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M2.178 13.7a9.639 9.639 0 0 0 0.566 3.063" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  copy: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M16.4999 5.5V1.50049c0 -0.552286 -0.4477 -1.000002 -1 -1.000002H1.49988C0.947593 0.500488 0.499878 0.948203 0.499878 1.50049V15.5005c0 0.5523 0.447715 1 1.000002 1H5.5" strokeWidth="1" />
      <Path stroke={color} strokeLinejoin="round" d="M7.4999 8.49951c0 -0.55228 0.44772 -1 1 -1h14c0.5523 0 1 0.44772 1 1V22.4995c0 0.5523 -0.4477 1 -1 1h-14c-0.55228 0 -1 -0.4477 -1 -1V8.49951Z" strokeWidth="1" />
    </Svg>
  ),

  paste: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="M9.5 21.5h-8a1 1 0 0 1 -1 -1v-16a1 1 0 0 1 1 -1h2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M13.5 3.5h2a1 1 0 0 1 1 1V8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M7 1.999a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M9.915 2.5H12.5a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h2.585" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M22.5 22.5a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1V11a1 1 0 0 1 1 -1h7.086a1 1 0 0 1 0.707 0.293l1.914 1.914a1 1 0 0 1 0.293 0.707Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m14.5 14.499 5 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m14.5 17.499 5 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  recovery_phrase: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="M4 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m20.5 0.5 -9.782 9.783a7 7 0 1 0 3 3L17 10h1.5V8.5L19 8h1.5V6.5L21 6h1.5V4.5l1 -1v-3Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  pin: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M20.5 10.5c0 -0.2652 -0.1054 -0.51957 -0.2929 -0.70711C20.0196 9.60536 19.7652 9.5 19.5 9.5h-15c-0.26522 0 -0.51957 0.10536 -0.70711 0.29289C3.60536 9.98043 3.5 10.2348 3.5 10.5v12c0 0.2652 0.10536 0.5196 0.29289 0.7071 0.18754 0.1875 0.44189 0.2929 0.70711 0.2929h15c0.2652 0 0.5196 -0.1054 0.7071 -0.2929s0.2929 -0.4419 0.2929 -0.7071v-12Z" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M6.5 6c0 -1.45869 0.57946 -2.85764 1.61091 -3.88909S10.5413 0.5 12 0.5c1.4587 0 2.8576 0.57946 3.8891 1.61091C16.9205 3.14236 17.5 4.54131 17.5 6v3.5h-11V6Z" strokeWidth="1" />
      <Path stroke={color} d="M8.5 13.5c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M8.5 13.5c0.13807 0 0.25 -0.1119 0.25 -0.25S8.63807 13 8.5 13" strokeWidth="1" />
      <Path stroke={color} d="M12 13.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M12 13.5c0.1381 0 0.25 -0.1119 0.25 -0.25S12.1381 13 12 13" strokeWidth="1" />
      <Path stroke={color} d="M15.5 13.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M15.5 13.5c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M8.5 17c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M8.5 17c0.13807 0 0.25 -0.1119 0.25 -0.25s-0.11193 -0.25 -0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M8.5 20.5c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25" strokeWidth="1" />
      <Path stroke={color} d="M8.5 20.5c0.13807 0 0.25 -0.1119 0.25 -0.25S8.63807 20 8.5 20" strokeWidth="1" />
      <G>
        <Path stroke={color} d="M12 17c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" strokeWidth="1" />
        <Path stroke={color} d="M12 17c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25" strokeWidth="1" />
      </G>
      <G>
        <Path stroke={color} d="M12 20.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" strokeWidth="1" />
        <Path stroke={color} d="M12 20.5c0.1381 0 0.25 -0.1119 0.25 -0.25S12.1381 20 12 20" strokeWidth="1" />
      </G>
      <G>
        <Path stroke={color} d="M15.5 17c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" strokeWidth="1" />
        <Path stroke={color} d="M15.5 17c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25" strokeWidth="1" />
      </G>
      <G>
        <Path stroke={color} d="M15.5 20.5c-0.1381 0 -0.25 -0.1119 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" strokeWidth="1" />
        <Path stroke={color} d="M15.5 20.5c0.1381 0 0.25 -0.1119 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25" strokeWidth="1" />
      </G>
    </Svg>
  ),

  switch_account: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="M17.366 20.433a3.067 3.067 0 1 0 6.134 0 3.067 3.067 0 1 0 -6.134 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M20.433 17.367V8.678a5.111 5.111 0 0 0 -5.111 -5.111h-4.089" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m14.3 0.5 -3.067 3.067L14.3 6.633" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M0.5 3.567a3.067 3.067 0 1 0 6.134 0 3.067 3.067 0 1 0 -6.134 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M3.567 6.633v8.689a5.111 5.111 0 0 0 5.111 5.111h4.089" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m9.7 23.5 3.067 -3.067L9.7 17.367" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  logout: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="m23.5 12 -12 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m19.5 16 4 -4 -4 -4" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M9.5 2.5H17a0.5 0.5 0 0 1 0.5 0.5v2.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M17.5 18.5V21a0.5 0.5 0 0 1 -0.5 0.5H9.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M0.5 21.223a0.5 0.5 0 0 0 0.392 0.488l8 1.777A0.5 0.5 0 0 0 9.5 23V1a0.5 0.5 0 0 0 -0.608 -0.488l-8 1.778a0.5 0.5 0 0 0 -0.392 0.488Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M4.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  privacy_on: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <G>
        <Path d="M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0 -7 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <Path d="M23.38 11.67C22.21 10.35 17.56 5.5 12 5.5S1.79 10.35 0.62 11.67a0.52 0.52 0 0 0 0 0.66C1.79 13.65 6.44 18.5 12 18.5s10.21 -4.85 11.38 -6.17a0.52 0.52 0 0 0 0 -0.66Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      </G>
    </Svg>
  ),

  privacy_off: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M19.5035 8.29321C20.9851 9.35723 22.3277 10.6025 23.5 12c0 0 -5.1655 6.4943 -11.51 6.4943 -1.0183 -0.0177 -2.02837 -0.186 -2.99739 -0.4995" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M6.83449 17.1555C4.41203 15.859 2.26149 14.1087 0.5 12c0 0 5.14553 -6.49432 11.49 -6.49432 1.7997 0.03591 3.5657 0.49453 5.1555 1.33883" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M15.9865 12c0 1.0599 -0.421 2.0765 -1.1705 2.826 -0.7495 0.7495 -1.7661 1.1705 -2.826 1.1705" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M21.7315 2.25848 2.24847 21.7415" strokeWidth="1" />
      <Path stroke={color} strokeLinecap="round" strokeLinejoin="round" d="M9.16248 14.8276c-0.74991 -0.7499 -1.17121 -1.767 -1.17121 -2.8276 0 -1.0605 0.4213 -2.0776 1.17121 -2.82751 0.74991 -0.74991 1.76702 -1.17121 2.82752 -1.17121 1.0606 0 2.0776 0.4213 2.8276 1.17121" strokeWidth="1" />
    </Svg>
  ),

  delete_wallet: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="M17.5 23.5v-5a5 5 0 0 0 5 -5V11a10.5 10.5 0 0 0 -21 0v2.5a5 5 0 0 0 5 5v5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M6.441 4.5c0 2.734 -1.636 4 -3.441 4H1.8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M4 12.5a3 3 0 1 0 6 0 3 3 0 1 0 -6 0Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M17.559 4.5c0 2.734 1.636 4 3.441 4h1.2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M14 12.5a3 3 0 1 0 6 0 3 3 0 1 0 -6 0Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m11 16 0.276 -0.553a0.81 0.81 0 0 1 1.448 0L13 16" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m10 18.5 0 5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m14 18.5 0 5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  face_id: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="M0.5 6.5v-3a3 3 0 0 1 3 -3h3" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M23.5 6.5v-3a3 3 0 0 0 -3 -3h-3" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M0.5 17.5v3a3 3 0 0 0 3 3h3" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M23.5 17.5v3a3 3 0 0 1 -3 3h-3" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M12.5 8v4.5A1.5 1.5 0 0 1 11 14h-0.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m7.5 8 0 2.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m17.5 8 0 2.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="M8.233 17a5.48 5.48 0 0 0 7.534 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  delete: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path d="M8.284 3.5h14.049a1 1 0 0 1 1 1v15a1 1 0 0 1 -1 1H8.284a1 1 0 0 1 -0.75 -0.338l-6.617 -7.5a1 1 0 0 1 0 -1.324l6.617 -7.5a1 1 0 0 1 0.75 -0.338Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m10.833 8 8 8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <Path d="m18.833 8 -8 8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </Svg>
  ),

  done: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <G>
        <Path d="m18 7 -6.38 8.66a1 1 0 0 1 -0.68 0.4 1 1 0 0 1 -0.75 -0.21L6 12.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <Path d="M0.5 12a11.5 11.5 0 1 0 23 0 11.5 11.5 0 1 0 -23 0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      </G>
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
export default function Icon({ name, size = 24, color = '#DDDDDD', style }) {
  const IconComponent = IconComponents[name];

  if (!IconComponent) {
    console.error(`Icon "${name}" not found`);
    return null;
  }

  return (
    <IconComponent width={size} height={size} color={color} style={style} />
  );
}

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.number,
  color: PropTypes.string,
  style: PropTypes.object,
};
