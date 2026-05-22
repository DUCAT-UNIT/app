/**
 * PSBT Binary Utilities
 * Low-level functions for parsing and patching PSBT binary data
 */

import { Buffer } from 'buffer';
import { varIntSize, writeVarInt } from '../../utils/wallet/cryptoHelpers';
import type { PsbtFieldData, SignatureData } from './types';

/**
 * Read a varint from buffer
 */
export function readVarInt(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
  const first = buffer[offset];
  if (first < 0xfd) {
    return { value: first, bytesRead: 1 };
  } else if (first === 0xfd) {
    return { value: buffer.readUInt16LE(offset + 1), bytesRead: 3 };
  } else if (first === 0xfe) {
    return { value: buffer.readUInt32LE(offset + 1), bytesRead: 5 };
  } else {
    // 0xff - 8 byte, but for PSBT this is unlikely
    throw new Error('64-bit varint not supported');
  }
}

/**
 * Count PSBT inputs by parsing the binary
 */
export function countPsbtInputs(psbtBuffer: Buffer, _startOffset = 5): number {
  // The global map contains PSBT_GLOBAL_UNSIGNED_TX (0x00) which has the tx
  // We need to parse it to get input count
  let offset = 5; // skip magic

  while (psbtBuffer[offset] !== 0x00) {
    const keyLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(keyLen.value);
    const keyStart = offset;
    offset += keyLen.value;
    const valLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(valLen.value);

    // Check if this is the unsigned tx (key type 0x00)
    if (keyLen.value === 1 && psbtBuffer[keyStart] === 0x00) {
      // Parse tx to get input count
      const txStart = offset;
      let txOffset = txStart;
      txOffset += 4; // version

      // Check for witness marker
      if (psbtBuffer[txOffset] === 0x00 && psbtBuffer[txOffset + 1] === 0x01) {
        txOffset += 2; // marker + flag
      }

      // Read input count
      const inputCountVi = readVarInt(psbtBuffer, txOffset);
      return inputCountVi.value;
    }

    offset += valLen.value;
  }

  throw new Error('Could not find unsigned tx in PSBT');
}

/**
 * Create a PSBT key-value pair
 */
export function createPsbtKv(key: Buffer, value: Buffer): Buffer {
  const keyLenBuf = Buffer.allocUnsafe(varIntSize(key.length));
  writeVarInt(keyLenBuf, key.length, 0);

  const valLenBuf = Buffer.allocUnsafe(varIntSize(value.length));
  writeVarInt(valLenBuf, value.length, 0);

  return Buffer.concat([keyLenBuf, key, valLenBuf, value]);
}

/**
 * Encode a witness stack into the format used in PSBT_IN_FINAL_SCRIPTWITNESS
 */
export function encodeWitnessStack(witness: Buffer[]): Buffer {
  const parts: Buffer[] = [];

  // Witness item count as varint
  const countBuf = Buffer.allocUnsafe(varIntSize(witness.length));
  writeVarInt(countBuf, witness.length, 0);
  parts.push(countBuf);

  // Each witness element: length (varint) + data
  for (const item of witness) {
    const lenBuf = Buffer.allocUnsafe(varIntSize(item.length));
    writeVarInt(lenBuf, item.length, 0);
    parts.push(lenBuf);
    parts.push(item);
  }

  return Buffer.concat(parts);
}

/**
 * Extract OP_RETURN output from a PSBT's unsigned transaction for vault diagnostics.
 * Returns the hex of the OP_RETURN scriptPubKey or null if not found
 */
export function extractOpReturnFromPsbt(psbtBase64: string): string | null {
  try {
    const psbtBuffer = Buffer.from(psbtBase64, 'base64');
    let offset = 5; // skip magic

    // Find unsigned tx in global map
    while (psbtBuffer[offset] !== 0x00) {
      const keyLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(keyLen.value);
      const keyStart = offset;
      offset += keyLen.value;
      const valLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(valLen.value);

      // Check if this is unsigned tx (key type 0x00)
      if (keyLen.value === 1 && psbtBuffer[keyStart] === 0x00) {
        const txStart = offset;
        let txOffset = txStart;
        txOffset += 4; // version

        // Check for witness marker
        if (psbtBuffer[txOffset] === 0x00 && psbtBuffer[txOffset + 1] === 0x01) {
          txOffset += 2;
        }

        // Skip inputs
        const inputCount = readVarInt(psbtBuffer, txOffset);
        txOffset += varIntSize(inputCount.value);
        for (let i = 0; i < inputCount.value; i++) {
          txOffset += 32; // txid
          txOffset += 4; // vout
          const scriptLen = readVarInt(psbtBuffer, txOffset);
          txOffset += varIntSize(scriptLen.value) + scriptLen.value;
          txOffset += 4; // sequence
        }

        // Read outputs
        const outputCount = readVarInt(psbtBuffer, txOffset);
        txOffset += varIntSize(outputCount.value);

        for (let i = 0; i < outputCount.value; i++) {
          txOffset += 8; // value (8 bytes)
          const scriptLen = readVarInt(psbtBuffer, txOffset);
          txOffset += varIntSize(scriptLen.value);
          const scriptPubKey = psbtBuffer.slice(txOffset, txOffset + scriptLen.value);
          txOffset += scriptLen.value;

          // Check if OP_RETURN (starts with 0x6a)
          if (scriptPubKey[0] === 0x6a) {
            return scriptPubKey.toString('hex');
          }
        }
      }

      offset += valLen.value;
    }
    return null;
  } catch (e) {
    return `error: ${e}`;
  }
}

/**
 * Patch signatures into a PSBT without re-encoding the transaction outputs.
 * This preserves OP_RETURN outputs that would be corrupted by full re-encoding.
 */
export function patchPsbtSignatures(psbtBase64: string, signatures: SignatureData[]): string {
  const psbtBuffer = Buffer.from(psbtBase64, 'base64');
  const parts: Buffer[] = [];
  let offset = 0;

  // PSBT magic bytes: 0x70736274ff
  if (psbtBuffer.slice(0, 5).toString('hex') !== '70736274ff') {
    throw new Error('Invalid PSBT magic');
  }
  parts.push(psbtBuffer.slice(0, 5));
  offset = 5;

  // Parse global map (skip to end marker 0x00)
  const globalStart = offset;
  while (psbtBuffer[offset] !== 0x00) {
    const keyLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(keyLen.value);
    offset += keyLen.value; // key
    const valLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(valLen.value);
    offset += valLen.value; // value
  }
  parts.push(psbtBuffer.slice(globalStart, offset + 1)); // include 0x00 terminator
  offset++;

  // Count inputs by parsing until we hit output maps
  // We need to know how many inputs there are
  const inputCount = countPsbtInputs(psbtBuffer);

  // Parse each input map and inject signatures
  for (let inputIdx = 0; inputIdx < inputCount; inputIdx++) {
    const inputParts: Buffer[] = [];

    // Read existing key-value pairs
    while (psbtBuffer[offset] !== 0x00) {
      const kvStart = offset;
      const keyLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(keyLen.value);
      offset += keyLen.value;
      const valLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(valLen.value);
      offset += valLen.value;
      inputParts.push(psbtBuffer.slice(kvStart, offset));
    }

    // Check if we need to add a signature for this input
    const sigForInput = signatures.find((s) => s.inputIndex === inputIdx);
    if (sigForInput) {
      // Create signature key-value pair based on type
      let sigKv: Buffer;
      if (sigForInput.type === 'segwit' && sigForInput.pubkey) {
        // PSBT_IN_PARTIAL_SIG (0x02): key = 0x02 || pubkey, value = signature
        const keyType = Buffer.from([0x02]);
        const key = Buffer.concat([keyType, sigForInput.pubkey]);
        sigKv = createPsbtKv(key, sigForInput.signature);
      } else if (sigForInput.type === 'taproot-key') {
        // PSBT_IN_TAP_KEY_SIG (0x13): key = 0x13, value = signature
        const key = Buffer.from([0x13]);
        sigKv = createPsbtKv(key, sigForInput.signature);
      } else if (
        sigForInput.type === 'taproot-script' &&
        sigForInput.pubkey &&
        sigForInput.leafHash
      ) {
        // PSBT_IN_TAP_SCRIPT_SIG (0x14): key = 0x14 || xonlypubkey || leafhash, value = signature
        const keyType = Buffer.from([0x14]);
        const key = Buffer.concat([keyType, sigForInput.pubkey, sigForInput.leafHash]);
        sigKv = createPsbtKv(key, sigForInput.signature);
      } else {
        throw new Error(`Invalid signature type: ${sigForInput.type}`);
      }
      inputParts.push(sigKv);
    }

    // Write input map with terminator
    for (const part of inputParts) {
      parts.push(part);
    }
    parts.push(Buffer.from([0x00])); // terminator
    offset++; // skip original terminator
  }

  // Copy remaining output maps unchanged
  parts.push(psbtBuffer.slice(offset));

  const result = Buffer.concat(parts);
  return result.toString('base64');
}

/**
 * Patch arbitrary fields into PSBT input maps
 */
export function patchPsbtInputFields(psbtBase64: string, fieldsToAdd: PsbtFieldData[]): string {
  const psbtBuffer = Buffer.from(psbtBase64, 'base64');
  const parts: Buffer[] = [];
  let offset = 0;

  // PSBT magic bytes
  if (psbtBuffer.slice(0, 5).toString('hex') !== '70736274ff') {
    throw new Error('Invalid PSBT magic');
  }
  parts.push(psbtBuffer.slice(0, 5));
  offset = 5;

  // Parse global map
  const globalStart = offset;
  while (psbtBuffer[offset] !== 0x00) {
    const keyLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(keyLen.value);
    offset += keyLen.value;
    const valLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(valLen.value);
    offset += valLen.value;
  }
  parts.push(psbtBuffer.slice(globalStart, offset + 1));
  offset++;

  // Count inputs
  const inputCount = countPsbtInputs(psbtBuffer);

  // Parse each input map and add fields
  for (let inputIdx = 0; inputIdx < inputCount; inputIdx++) {
    const inputParts: Buffer[] = [];

    // Read existing key-value pairs, filtering out duplicates
    const existingKeyTypes = new Set<number>();
    while (psbtBuffer[offset] !== 0x00) {
      const kvStart = offset;
      const keyLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(keyLen.value);
      const keyStart = offset;
      offset += keyLen.value;
      const valLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(valLen.value);
      offset += valLen.value;

      // Track existing key types
      if (keyLen.value >= 1) {
        existingKeyTypes.add(psbtBuffer[keyStart]);
      }

      inputParts.push(psbtBuffer.slice(kvStart, offset));
    }

    // Add new fields for this input (if not already present)
    const fieldsForInput = fieldsToAdd.find((f) => f.inputIndex === inputIdx);
    if (fieldsForInput) {
      for (const field of fieldsForInput.fields) {
        if (!existingKeyTypes.has(field.keyType)) {
          const kv = createPsbtKv(field.key, field.value);
          inputParts.push(kv);
        }
      }
    }

    // Write input map with terminator
    for (const part of inputParts) {
      parts.push(part);
    }
    parts.push(Buffer.from([0x00]));
    offset++;
  }

  // Copy remaining output maps unchanged
  parts.push(psbtBuffer.slice(offset));

  const result = Buffer.concat(parts);
  return result.toString('base64');
}
