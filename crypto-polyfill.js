// Polyfill Buffer for React Native
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

const BufferCtor = global.Buffer || require('buffer').Buffer;

function hasWorkingTextEncoder(Encoder) {
  try {
    return (
      typeof Encoder === 'function' &&
      BufferCtor.from(new Encoder().encode('psbt')).toString('hex') === '70736274'
    );
  } catch (_e) {
    return false;
  }
}

function hasWorkingTextDecoder(Decoder) {
  try {
    return (
      typeof Decoder === 'function' &&
      new Decoder('utf-8').decode(Uint8Array.from([0x70, 0x73, 0x62, 0x74])) === 'psbt'
    );
  } catch (_e) {
    return false;
  }
}

class BufferTextEncoder {
  encoding = 'utf-8';

  encode(input = '') {
    return Uint8Array.from(BufferCtor.from(String(input), 'utf8'));
  }

  encodeInto(input = '', destination) {
    const source = String(input);
    const encoded = this.encode(source);
    const written = Math.min(encoded.length, destination.length);
    destination.set(encoded.subarray(0, written));
    return {
      read: written === encoded.length ? source.length : written,
      written,
    };
  }
}

class BufferTextDecoder {
  encoding = 'utf-8';
  fatal = false;
  ignoreBOM = false;

  constructor(_label = 'utf-8', options = {}) {
    this.fatal = Boolean(options.fatal);
    this.ignoreBOM = Boolean(options.ignoreBOM);
  }

  decode(input = new Uint8Array()) {
    if (input instanceof ArrayBuffer) {
      return BufferCtor.from(new Uint8Array(input)).toString('utf8');
    }

    if (ArrayBuffer.isView(input)) {
      return BufferCtor.from(input.buffer, input.byteOffset, input.byteLength).toString('utf8');
    }

    return BufferCtor.from(input).toString('utf8');
  }
}

function defineGlobal(name, value) {
  try {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  } catch (_e) {
    globalThis[name] = value;
  }

  if (typeof global !== 'undefined' && global[name] !== value) {
    try {
      Object.defineProperty(global, name, {
        configurable: true,
        writable: true,
        value,
      });
    } catch (_e) {
      global[name] = value;
    }
  }
}

if (!hasWorkingTextEncoder(globalThis.TextEncoder)) {
  defineGlobal('TextEncoder', BufferTextEncoder);
}

if (!hasWorkingTextDecoder(globalThis.TextDecoder)) {
  defineGlobal('TextDecoder', BufferTextDecoder);
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
  if (!hasWorkingTextEncoder(window.TextEncoder)) {
    window.TextEncoder = globalThis.TextEncoder;
  }
  if (!hasWorkingTextDecoder(window.TextDecoder)) {
    window.TextDecoder = globalThis.TextDecoder;
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
