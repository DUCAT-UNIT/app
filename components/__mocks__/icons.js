/**
 * Mock Icon Component for Testing
 */

console.log('[MOCK] Loading Icon mock from __mocks__/icons.js');

const React = require('react');

const Icon = React.memo(({ name, size, color, style }) => {
  console.log('[MOCK] Icon called with name:', name);
  // Return a simple View-like element for testing
  return React.createElement('MockIcon', { testID: `icon-${name}` }, name);
});

Icon.displayName = 'Icon';

module.exports = Icon;
module.exports.default = Icon;
module.exports.NavigationIcons = {};
module.exports.WalletIcons = {};
module.exports.SecurityIcons = {};
module.exports.BrandIcons = {};
module.exports.UIIcons = {};
