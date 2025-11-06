// Lazy import to avoid blocking during module initialization
let getRandomValuesImpl = null;

// Polyfill crypto.getRandomValues for React Native
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function (array) {
    // Lazy load expo-crypto only when actually called
    if (!getRandomValuesImpl) {
      const ExpoCrypto = require('expo-crypto');
      getRandomValuesImpl = ExpoCrypto.getRandomValues;
    }
    return getRandomValuesImpl(array);
  };
}

// Also polyfill on window if it exists
if (typeof window !== 'undefined') {
  if (typeof window.crypto !== 'object') {
    window.crypto = {};
  }
  if (typeof window.crypto.getRandomValues !== 'function') {
    window.crypto.getRandomValues = global.crypto.getRandomValues;
  }
}

// Verify it's set
