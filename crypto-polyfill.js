// Polyfill Buffer for React Native
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

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
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = global.Buffer;
  }
  if (typeof window.crypto !== 'object') {
    window.crypto = {};
  }
  if (typeof window.crypto.getRandomValues !== 'function') {
    window.crypto.getRandomValues = global.crypto.getRandomValues;
  }
}

// Configure @noble/secp256k1 to use pure JS hashing (@noble/hashes)
// react-native-quick-crypto's crypto.subtle implementation crashes with
// "unordered_map::at: key not found" on certain ECC operations
try {
  const { sha256 } = require('@noble/hashes/sha256');
  const { hmac } = require('@noble/hashes/hmac');
  const { etc: secp256k1etc, hashes: secp256k1hashes } = require('@noble/secp256k1');

  // Override sync hashes
  secp256k1etc.hmacSha256Sync = (key, ...msgs) => {
    const h = hmac.create(sha256, key);
    msgs.forEach((m) => h.update(m));
    return h.digest();
  };
  secp256k1etc.sha256Sync = (...msgs) => {
    const h = sha256.create();
    msgs.forEach((m) => h.update(m));
    return h.digest();
  };

  // Override async hashes too — noble uses these for schnorr.verify and signAsync
  if (secp256k1hashes) {
    secp256k1hashes.hmacSha256Async = async (key, message) => {
      return hmac(sha256, key, message);
    };
    secp256k1hashes.sha256Async = async (msg) => {
      return sha256(msg);
    };
    // Also set sync versions on hashes object
    secp256k1hashes.hmacSha256 = (key, message) => {
      return hmac(sha256, key, message);
    };
    secp256k1hashes.sha256 = (msg) => {
      return sha256(msg);
    };
  }

} catch (_e) {
  console.warn('[crypto-polyfill] Failed to configure noble hashing:', _e?.message);
}

// Remove crypto.subtle to force noble to use sync fallbacks
// react-native-quick-crypto provides a broken crypto.subtle that crashes
if (global.crypto && global.crypto.subtle) {
  delete global.crypto.subtle;
}
if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
  delete window.crypto.subtle;
}

// Verify it's set
