/**
 * Icon Component - Barrel Export
 * Unified icon system combining all icon categories
 */

import React from 'react';
import PropTypes from 'prop-types';
import { NavigationIcons } from './NavigationIcons';
import { WalletIcons } from './WalletIcons';
import { SecurityIcons } from './SecurityIcons';
import { BrandIcons } from './BrandIcons';
import { UIIcons } from './UIIcons';

// Combine all icon categories into a single object
const IconComponents = {
  ...NavigationIcons,
  ...WalletIcons,
  ...SecurityIcons,
  ...BrandIcons,
  ...UIIcons,
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

// Also export individual categories for direct access if needed
export { NavigationIcons, WalletIcons, SecurityIcons, BrandIcons, UIIcons };
