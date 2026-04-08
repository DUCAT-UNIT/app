import { Buffer } from 'buffer';

/**
 * Encode a number as a LEB128 varint
 * @param {bigint} value - The value to encode
 * @returns {Buffer} The encoded varint
 */
function encodeVarint(value) {
  const bytes = [];
  let n = BigInt(value);

  while (n >= 128n) {
    bytes.push(Number(n & 127n) | 128);
    n >>= 7n;
  }
  bytes.push(Number(n));

  return Buffer.from(bytes);
}

/**
 * Decode a LEB128 varint from a buffer
 * @param {Buffer} buffer - The buffer to decode from
 * @param {number} offset - Starting offset in the buffer
 * @returns {Object} Object with value and newOffset
 */
function decodeVarint(buffer, offset) {
  let value = 0n;
  let shift = 0n;
  let currentOffset = offset;

  while (currentOffset < buffer.length) {
    const byte = buffer[currentOffset];
    value |= BigInt(byte & 127) << shift;
    currentOffset++;

    if ((byte & 128) === 0) {
      break;
    }
    shift += 7n;
  }

  return { value, newOffset: currentOffset };
}

/**
 * Encode a runestone with edicts
 * @param {Object} config - Runestone configuration
 * @param {Array} config.edicts - Array of edicts
 * @returns {Object} Result with encodedRunestone
 */
export function encodeRunestone(config) {
  const { edicts = [] } = config;

  // Basic validation
  edicts.forEach((edict) => {
    if (!edict || typeof edict !== 'object') {
      throw new Error('Invalid edict entry');
    }
    const { id, amount, output } = edict;
    if (!id || typeof id.block === 'undefined' || typeof id.tx === 'undefined') {
      throw new Error('Edict missing id.block or id.tx');
    }
    if (amount === undefined || amount < 0) {
      throw new Error('Edict amount must be non-negative');
    }
    if (output === undefined || output < 0) {
      throw new Error('Edict output must be non-negative');
    }
  });

  if (!edicts || edicts.length === 0) {
    // Empty runestone: OP_RETURN + OP_13
    return {
      encodedRunestone: Buffer.from([0x6a, 0x5d, 0x00]),
      etchingCommitment: undefined,
    };
  }

  // Build the runestone payload
  const payload = [];

  // Tag for edicts (0 = edicts)
  payload.push(...encodeVarint(0n));

  // Encode edicts
  let previousBlock = 0n;
  let previousTx = 0n;

  for (const edict of edicts) {
    const { id, amount, output } = edict;

    // Delta encode block
    const blockDelta = BigInt(id.block) - previousBlock;
    payload.push(...encodeVarint(blockDelta));
    previousBlock = BigInt(id.block);

    // Delta encode tx
    const txDelta = BigInt(id.tx) - previousTx;
    payload.push(...encodeVarint(txDelta));
    previousTx = BigInt(id.tx);

    // Encode amount
    payload.push(...encodeVarint(BigInt(amount)));

    // Encode output
    payload.push(...encodeVarint(BigInt(output)));
  }

  const payloadBuffer = Buffer.from(payload);

  // Build the complete script:
  // OP_RETURN (0x6a) + OP_13 (0x5d) + push payload with correct opcode
  let pushOpcode;
  const payloadLength = payloadBuffer.length;
  if (payloadLength <= 75) {
    pushOpcode = Buffer.from([payloadLength]);
  } else if (payloadLength <= 0xff) {
    pushOpcode = Buffer.from([0x4c, payloadLength]); // OP_PUSHDATA1
  } else if (payloadLength <= 0xffff) {
    // OP_PUSHDATA2 (0x4d) + 2-byte little-endian length
    pushOpcode = Buffer.alloc(3);
    pushOpcode[0] = 0x4d;
    pushOpcode.writeUInt16LE(payloadLength, 1);
  } else {
    throw new Error('Runestone payload too large');
  }

  const script = Buffer.concat([
    Buffer.from([0x6a]), // OP_RETURN
    Buffer.from([0x5d]), // OP_13 (Runes protocol identifier)
    pushOpcode,
    payloadBuffer,
  ]);

  return {
    encodedRunestone: script,
    etchingCommitment: undefined,
  };
}

/**
 * Decode a runestone from an OP_RETURN script
 * @param {Buffer|string} script - The OP_RETURN script (hex string or Buffer)
 * @returns {Object|null} Decoded runestone or null if invalid
 */
export function decodeRunestone(script) {
  try {
    // Convert hex string to Buffer if needed
    const scriptBuffer = typeof script === 'string' ? Buffer.from(script, 'hex') : script;

    // Check if it's an OP_RETURN (0x6a)
    if (scriptBuffer[0] !== 0x6a) {
      return null;
    }

    // Check if it has the Runes protocol tag (OP_13 = 0x5d)
    if (scriptBuffer[1] !== 0x5d) {
      return null;
    }

    // Empty runestone check
    if (scriptBuffer.length === 3 && scriptBuffer[2] === 0x00) {
      return { edicts: [] };
    }

    // Handle variable-length push opcodes
    let payloadLength, payloadStart;
    const pushByte = scriptBuffer[2];
    if (pushByte <= 75) {
      // OP_PUSHBYTES_N: single-byte length
      payloadLength = pushByte;
      payloadStart = 3;
    } else if (pushByte === 0x4c) {
      // OP_PUSHDATA1: 1-byte length follows
      payloadLength = scriptBuffer[3];
      payloadStart = 4;
    } else if (pushByte === 0x4d) {
      // OP_PUSHDATA2: 2-byte LE length follows
      payloadLength = scriptBuffer.readUInt16LE(3);
      payloadStart = 5;
    } else {
      return null; // Unknown push opcode
    }

    // Extract payload
    const payload = scriptBuffer.slice(payloadStart, payloadStart + payloadLength);

    let offset = 0;
    const edicts = [];

    // Decode tag (should be 0 for edicts)
    const tagResult = decodeVarint(payload, offset);
    if (tagResult.value !== 0n) {
      // Not an edicts tag, might be other runestone data
      return { edicts: [] };
    }
    offset = tagResult.newOffset;

    // Decode edicts with delta encoding
    let previousBlock = 0n;
    let previousTx = 0n;

    while (offset < payload.length) {
      // Decode block delta
      const blockDeltaResult = decodeVarint(payload, offset);
      const block = previousBlock + blockDeltaResult.value;
      offset = blockDeltaResult.newOffset;

      // Decode tx delta
      const txDeltaResult = decodeVarint(payload, offset);
      const tx = previousTx + txDeltaResult.value;
      offset = txDeltaResult.newOffset;

      // Decode amount
      const amountResult = decodeVarint(payload, offset);
      const amount = amountResult.value;
      offset = amountResult.newOffset;

      // Decode output
      const outputResult = decodeVarint(payload, offset);
      const output = outputResult.value;
      offset = outputResult.newOffset;

      edicts.push({
        id: { block, tx },
        amount,
        output,
      });

      // Update previous values for delta encoding
      previousBlock = block;
      previousTx = tx;
    }

    return { edicts };
  } catch (error) {
    return null;
  }
}
