import { getRandomBytes } from 'expo-random';

// Polyfill crypto.getRandomValues for React Native
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function (array) {
    const bytes = getRandomBytes(array.length);
    for (let i = 0; i < array.length; i++) {
      array[i] = bytes[i];
    }
    return array;
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
console.log('crypto.getRandomValues polyfilled:', typeof global.crypto.getRandomValues === 'function');
