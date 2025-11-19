const { Buffer } = require('buffer');

/**
 * Decode a LEB128 varint from a buffer
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
 * Decode a runestone from an OP_RETURN script
 */
function decodeRunestone(script) {
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

    // Get payload length (OP_PUSHBYTES_N)
    const payloadLength = scriptBuffer[2];

    // Extract payload
    const payload = scriptBuffer.slice(3, 3 + payloadLength);

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

// The full OP_RETURN script from the transaction
// OP_RETURN (6a) + OP_13 (5d) + OP_PUSHBYTES_9 (09) + payload (00b89c5d0180c80101)
const runestoneHex = '6a5d0900b89c5d0180c80101';

console.log('Decoding runestone from transaction:');
console.log('Hex:', runestoneHex);
console.log('');

const decoded = decodeRunestone(runestoneHex);

if (decoded) {
  console.log('Decoded Runestone:');
  console.log(JSON.stringify(decoded, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));

  if (decoded.edicts && decoded.edicts.length > 0) {
    console.log('\nEdicts Details:');
    decoded.edicts.forEach((edict, index) => {
      console.log(`\nEdict ${index + 1}:`);
      console.log(`  Rune ID: ${edict.id.block}:${edict.id.tx}`);
      console.log(`  Amount: ${edict.amount}`);
      console.log(`  Output: ${edict.output}`);
    });
  }
} else {
  console.log('Failed to decode runestone');
}
