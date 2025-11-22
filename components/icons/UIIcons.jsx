/**
 * UIIcons - UI elements and utility icons
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const UIIcons = {
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

  link: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  external_link: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 3h6v6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 14L21 3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  share: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 6l-4-4-4 4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 2v13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  check: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  qr_scan: ({ width, height, color }) => (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7V5a2 2 0 0 1 2-2h2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 3h2a2 2 0 0 1 2 2v2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 17v2a2 2 0 0 1-2 2h-2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 21H5a2 2 0 0 1-2-2v-2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
};
