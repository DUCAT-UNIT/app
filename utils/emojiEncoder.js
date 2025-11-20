/**
 * Emoji Encoder/Decoder
 * Encodes binary data into a single emoji with variation selectors
 * Based on https://github.com/paulgb/emoji-encoder
 *
 * This uses Unicode variation selectors (invisible characters) to encode
 * data into a single visible emoji character.
 */

// The ghost emoji to use for Spectre tokens
const SPECTRE_EMOJI = '👻';

// Variation selectors block https://unicode.org/charts/nameslist/n_FE00.html
// VS1..=VS16
const VARIATION_SELECTOR_START = 0xfe00;
const VARIATION_SELECTOR_END = 0xfe0f;

// Variation selectors supplement https://unicode.org/charts/nameslist/n_E0100.html
// VS17..=VS256
const VARIATION_SELECTOR_SUPPLEMENT_START = 0xe0100;
const VARIATION_SELECTOR_SUPPLEMENT_END = 0xe01ef;

/**
 * Convert a byte (0-255) to a variation selector character
 * @param {number} byte - Byte value 0-255
 * @returns {string|null} Variation selector character or null
 */
function toVariationSelector(byte) {
  if (byte >= 0 && byte < 16) {
    return String.fromCodePoint(VARIATION_SELECTOR_START + byte);
  } else if (byte >= 16 && byte < 256) {
    return String.fromCodePoint(VARIATION_SELECTOR_SUPPLEMENT_START + byte - 16);
  } else {
    return null;
  }
}

/**
 * Convert a variation selector codepoint back to a byte value
 * @param {number} codePoint - Unicode codepoint
 * @returns {number|null} Byte value 0-255 or null
 */
function fromVariationSelector(codePoint) {
  if (codePoint >= VARIATION_SELECTOR_START && codePoint <= VARIATION_SELECTOR_END) {
    return codePoint - VARIATION_SELECTOR_START;
  } else if (codePoint >= VARIATION_SELECTOR_SUPPLEMENT_START && codePoint <= VARIATION_SELECTOR_SUPPLEMENT_END) {
    return codePoint - VARIATION_SELECTOR_SUPPLEMENT_START + 16;
  } else {
    return null;
  }
}

/**
 * Encode text into an emoji with variation selectors
 * @param {string} emoji - Base emoji to use (e.g., 👻)
 * @param {string} text - Text to encode
 * @returns {string} Emoji with invisible variation selectors
 */
function encode(emoji, text) {
  // Convert the string to UTF-8 bytes
  const bytes = new TextEncoder().encode(text);
  let encoded = emoji;

  for (const byte of bytes) {
    const selector = toVariationSelector(byte);
    if (selector) {
      encoded += selector;
    }
  }

  return encoded;
}

/**
 * Decode text from an emoji with variation selectors
 * @param {string} text - Emoji string with variation selectors
 * @returns {string} Decoded text
 */
function decode(text) {
  const decoded = [];
  const chars = Array.from(text);

  for (const char of chars) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;

    const byte = fromVariationSelector(codePoint);

    if (byte === null && decoded.length > 0) {
      break;
    } else if (byte === null) {
      continue;
    }

    decoded.push(byte);
  }

  const decodedArray = new Uint8Array(decoded);
  return new TextDecoder().decode(decodedArray);
}

/**
 * Encode a Cashu token to a single ghost emoji with variation selectors
 * @param {string} token - Cashu token string (cashu...)
 * @returns {string} Ghost emoji (👻) with encoded token data
 */
export const encodeCashuToken = (token) => {
  try {
    console.log('[EmojiEncoder] Encoding token:', token.substring(0, 50) + '...');

    // Encode the entire token (including "cashu" prefix) into the ghost emoji
    const encoded = encode(SPECTRE_EMOJI, token);

    console.log('[EmojiEncoder] Encoded to ghost emoji, length:', encoded.length);
    console.log('[EmojiEncoder] First few chars:', encoded.substring(0, 5));

    return encoded;
  } catch (error) {
    console.error('[EmojiEncoder] Failed to encode Cashu token:', error);
    throw error;
  }
};

/**
 * Decode a ghost emoji with variation selectors back to Cashu token
 * @param {string} emojiToken - Ghost emoji with encoded token data
 * @returns {string} Cashu token string (cashu...)
 */
export const decodeCashuToken = (emojiToken) => {
  try {
    console.log('[EmojiEncoder] Decoding emoji token, length:', emojiToken.length);

    const decoded = decode(emojiToken);

    console.log('[EmojiEncoder] Decoded token:', decoded.substring(0, 50) + '...');

    return decoded;
  } catch (error) {
    console.error('[EmojiEncoder] Failed to decode Cashu token:', error);
    throw error;
  }
};
