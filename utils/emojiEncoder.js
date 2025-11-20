/**
 * Emoji Encoder/Decoder
 * Encodes binary data into emoji and vice versa
 * Based on https://github.com/paulgb/emoji-encoder
 */

// Emoji alphabet (256 unique emojis for byte mapping)
const EMOJI_ALPHABET = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
  '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
  '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯',
  '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
  '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧',
  '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
  '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠',
  '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
  '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹',
  '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉',
  '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓',
  '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛',
  '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯', '💢',
  '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️',
  '🗨️', '🗯️', '💭', '💤', '👋', '🤚', '🖐️', '✋',
  '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
  '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
  '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿',
  '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴',
  '👀', '👁️', '👅', '👄', '👶', '🧒', '👦', '👧',
  '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵',
  '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇',
  '🤦', '🤷', '👮', '🕵️', '💂', '👷', '🤴', '👸',
  '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼',
  '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜',
  '🧝', '🧞', '🧟', '💆', '💇', '🚶', '🧍', '🧎',
  '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗', '🤺'
];

/**
 * Encode a base64 string into emoji
 * @param {string} base64String - Base64 encoded string
 * @returns {string} Emoji encoded string
 */
export const encodeToEmoji = (base64String) => {
  try {
    // Convert base64 to binary string
    const binaryString = atob(base64String);

    // Convert each byte to emoji
    let emojiString = '';
    for (let i = 0; i < binaryString.length; i++) {
      const byte = binaryString.charCodeAt(i);
      emojiString += EMOJI_ALPHABET[byte];
    }

    return emojiString;
  } catch (error) {
    console.error('[EmojiEncoder] Failed to encode:', error);
    throw new Error('Failed to encode to emoji');
  }
};

/**
 * Decode an emoji string back to base64
 * @param {string} emojiString - Emoji encoded string
 * @returns {string} Base64 decoded string
 */
export const decodeFromEmoji = (emojiString) => {
  try {
    // Create reverse mapping
    const emojiToIndex = {};
    EMOJI_ALPHABET.forEach((emoji, index) => {
      emojiToIndex[emoji] = index;
    });

    // Split emoji string into individual emojis
    // Handle multi-codepoint emojis properly
    const emojis = Array.from(emojiString);

    // Convert each emoji back to byte
    let binaryString = '';
    for (const emoji of emojis) {
      const index = emojiToIndex[emoji];
      if (index === undefined) {
        throw new Error(`Unknown emoji: ${emoji}`);
      }
      binaryString += String.fromCharCode(index);
    }

    // Convert binary string back to base64
    return btoa(binaryString);
  } catch (error) {
    console.error('[EmojiEncoder] Failed to decode:', error);
    throw new Error('Failed to decode from emoji');
  }
};

/**
 * Encode a Cashu token to emoji format
 * @param {string} token - Cashu token string (cashuA...)
 * @returns {string} Emoji encoded token
 */
export const encodeCashuToken = (token) => {
  try {
    // Extract the base64 part after "cashuA"
    if (!token.startsWith('cashuA')) {
      throw new Error('Invalid Cashu token format');
    }

    const base64Part = token.substring(6); // Remove "cashuA" prefix
    const emojiEncoded = encodeToEmoji(base64Part);

    return emojiEncoded;
  } catch (error) {
    console.error('[EmojiEncoder] Failed to encode Cashu token:', error);
    throw error;
  }
};

/**
 * Decode an emoji token back to Cashu token format
 * @param {string} emojiToken - Emoji encoded token
 * @returns {string} Cashu token string (cashuA...)
 */
export const decodeCashuToken = (emojiToken) => {
  try {
    const base64Part = decodeFromEmoji(emojiToken);
    return `cashuA${base64Part}`;
  } catch (error) {
    console.error('[EmojiEncoder] Failed to decode Cashu token:', error);
    throw error;
  }
};
