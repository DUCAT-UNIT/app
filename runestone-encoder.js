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
 * Encode a runestone with edicts
 * @param {Object} config - Runestone configuration
 * @param {Array} config.edicts - Array of edicts
 * @returns {Object} Result with encodedRunestone
 */
export function encodeRunestone(config) {
  const { edicts = [] } = config;

  if (!edicts || edicts.length === 0) {
    // Empty runestone: OP_RETURN + OP_13
    return {
      encodedRunestone: Buffer.from([0x6a, 0x5d, 0x00]),
      etchingCommitment: undefined
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
  // OP_RETURN (0x6a) + OP_13 (0x5d) + OP_PUSHBYTES_N (length) + payload
  // OP_PUSHBYTES_1 to OP_PUSHBYTES_75 are opcodes 0x01 to 0x4b
  const script = Buffer.concat([
    Buffer.from([0x6a]), // OP_RETURN
    Buffer.from([0x5d]), // OP_13 (Runes protocol identifier)
    Buffer.from([payloadBuffer.length]), // OP_PUSHBYTES_N (where N is the length)
    payloadBuffer
  ]);


  return {
    encodedRunestone: script,
    etchingCommitment: undefined
  };
}
