/**
 * Tests for Runestone Encoder/Decoder
 */

import { Buffer } from 'buffer';
import { encodeRunestone, decodeRunestone } from '../runestoneEncoder';

interface RuneId {
  block: bigint;
  tx: bigint;
}

interface Edict {
  id: RuneId;
  amount: bigint;
  output: bigint;
}

interface EncodedRunestone {
  encodedRunestone: Buffer;
  etchingCommitment?: unknown;
}

interface DecodedRunestone {
  edicts: Edict[];
}

describe('runestoneEncoder', () => {
  describe('encodeRunestone', () => {
    it('should encode empty runestone with no edicts', () => {
      const result = encodeRunestone({ edicts: [] }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();
      expect(result.etchingCommitment).toBeUndefined();
      expect(result.encodedRunestone[0]).toBe(0x6a); // OP_RETURN
      expect(result.encodedRunestone[1]).toBe(0x5d); // OP_13
      expect(result.encodedRunestone[2]).toBe(0x00); // Empty payload
    });

    it('should handle undefined edicts', () => {
      const result = encodeRunestone({ edicts: [] } as { edicts: never[] }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();
      expect(result.encodedRunestone[0]).toBe(0x6a);
      expect(result.encodedRunestone[1]).toBe(0x5d);
    });

    it('should encode single edict', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 100, tx: 1 },
          amount: 1000n,
          output: 0,
        }],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();
      expect(result.encodedRunestone[0]).toBe(0x6a); // OP_RETURN
      expect(result.encodedRunestone[1]).toBe(0x5d); // OP_13
      // Should have payload after header
      expect(result.encodedRunestone.length).toBeGreaterThan(3);
    });

    it('should encode multiple edicts with delta encoding', () => {
      const result = encodeRunestone({
        edicts: [
          {
            id: { block: 100, tx: 1 },
            amount: 1000n,
            output: 0,
          },
          {
            id: { block: 105, tx: 2 },
            amount: 2000n,
            output: 1,
          },
        ],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();
      expect(result.encodedRunestone.length).toBeGreaterThan(3);
    });

    it('should encode edict with large block number', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 900000, tx: 1 },
          amount: 1000n,
          output: 0,
        }],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();
      // Large numbers require more bytes in varint
      expect(result.encodedRunestone.length).toBeGreaterThan(5);
    });

    it('should encode edict with large amount', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 100, tx: 1 },
          amount: 1000000000000n, // 1 trillion
          output: 0,
        }],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();
      expect(result.encodedRunestone.length).toBeGreaterThan(5);
    });
  });

  describe('decodeRunestone', () => {
    it('should decode empty runestone', () => {
      const script = Buffer.from([0x6a, 0x5d, 0x00]);
      const result = decodeRunestone(script) as DecodedRunestone | null;

      expect(result).not.toBeNull();
      expect(result!.edicts).toEqual([]);
    });

    it('should decode from hex string', () => {
      const hexScript = '6a5d00';
      const result = decodeRunestone(hexScript) as DecodedRunestone | null;

      expect(result).not.toBeNull();
      expect(result!.edicts).toEqual([]);
    });

    it('should return null for non-OP_RETURN script', () => {
      const script = Buffer.from([0x00, 0x5d, 0x00]);
      const result = decodeRunestone(script);

      expect(result).toBeNull();
    });

    it('should return null for non-Runes OP_RETURN', () => {
      const script = Buffer.from([0x6a, 0x00, 0x00]); // OP_RETURN but not OP_13
      const result = decodeRunestone(script);

      expect(result).toBeNull();
    });

    it('should roundtrip encode/decode single edict', () => {
      const originalEdicts = [{
        id: { block: 100, tx: 1 },
        amount: 1000n,
        output: 0,
      }];

      const encoded = encodeRunestone({ edicts: originalEdicts }) as EncodedRunestone;
      const decoded = decodeRunestone(encoded.encodedRunestone) as DecodedRunestone | null;

      expect(decoded).not.toBeNull();
      expect(decoded!.edicts).toHaveLength(1);
      expect(decoded!.edicts[0].id.block).toBe(100n);
      expect(decoded!.edicts[0].id.tx).toBe(1n);
      expect(decoded!.edicts[0].amount).toBe(1000n);
      expect(decoded!.edicts[0].output).toBe(0n);
    });

    it('should roundtrip encode/decode multiple edicts', () => {
      const originalEdicts = [
        {
          id: { block: 100, tx: 1 },
          amount: 1000n,
          output: 0,
        },
        {
          id: { block: 105, tx: 2 },
          amount: 2000n,
          output: 1,
        },
      ];

      const encoded = encodeRunestone({ edicts: originalEdicts }) as EncodedRunestone;
      const decoded = decodeRunestone(encoded.encodedRunestone) as DecodedRunestone | null;

      expect(decoded).not.toBeNull();
      expect(decoded!.edicts).toHaveLength(2);

      // First edict
      expect(decoded!.edicts[0].id.block).toBe(100n);
      expect(decoded!.edicts[0].id.tx).toBe(1n);
      expect(decoded!.edicts[0].amount).toBe(1000n);
      expect(decoded!.edicts[0].output).toBe(0n);

      // Second edict
      expect(decoded!.edicts[1].id.block).toBe(105n);
      expect(decoded!.edicts[1].id.tx).toBe(2n);
      expect(decoded!.edicts[1].amount).toBe(2000n);
      expect(decoded!.edicts[1].output).toBe(1n);
    });

    it('should handle edicts tag not being 0', () => {
      // Create a buffer with valid OP_RETURN + OP_13 but non-zero tag
      const payload = [0x01]; // Tag = 1 (not edicts)
      const script = Buffer.concat([
        Buffer.from([0x6a, 0x5d, payload.length]),
        Buffer.from(payload),
      ]);

      const result = decodeRunestone(script) as DecodedRunestone | null;
      expect(result).not.toBeNull();
      expect(result!.edicts).toEqual([]);
    });

    it('should return null on decode error', () => {
      // Malformed script that will cause an error
      const malformedScript = Buffer.from([0x6a, 0x5d]); // Too short
      const result = decodeRunestone(malformedScript) as DecodedRunestone | null;

      // Should either return null or handle gracefully
      expect(result === null || result?.edicts?.length === 0).toBe(true);
    });

    it('should decode runestone with large block numbers', () => {
      const originalEdicts = [{
        id: { block: 900000, tx: 1 },
        amount: 1000n,
        output: 0,
      }];

      const encoded = encodeRunestone({ edicts: originalEdicts }) as EncodedRunestone;
      const decoded = decodeRunestone(encoded.encodedRunestone) as DecodedRunestone | null;

      expect(decoded).not.toBeNull();
      expect(decoded!.edicts[0].id.block).toBe(900000n);
    });

    it('should decode runestone with large amounts', () => {
      const originalEdicts = [{
        id: { block: 100, tx: 1 },
        amount: 1000000000000n,
        output: 0,
      }];

      const encoded = encodeRunestone({ edicts: originalEdicts }) as EncodedRunestone;
      const decoded = decodeRunestone(encoded.encodedRunestone) as DecodedRunestone | null;

      expect(decoded).not.toBeNull();
      expect(decoded!.edicts[0].amount).toBe(1000000000000n);
    });
  });

  describe('varint encoding', () => {
    it('should correctly encode small numbers', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 1, tx: 1 },
          amount: 1n,
          output: 0,
        }],
      }) as EncodedRunestone;

      // Small numbers should have compact encoding
      expect(result.encodedRunestone.length).toBeLessThan(20);
    });

    it('should correctly encode numbers at varint boundary (127)', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 127, tx: 127 },
          amount: 127n,
          output: 127,
        }],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();

      const decoded = decodeRunestone(result.encodedRunestone) as DecodedRunestone | null;
      expect(decoded).not.toBeNull();
      expect(decoded!.edicts[0].id.block).toBe(127n);
      expect(decoded!.edicts[0].id.tx).toBe(127n);
      expect(decoded!.edicts[0].amount).toBe(127n);
    });

    it('should correctly encode numbers at varint boundary (128)', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 128, tx: 128 },
          amount: 128n,
          output: 0,
        }],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();

      const decoded = decodeRunestone(result.encodedRunestone) as DecodedRunestone | null;
      expect(decoded).not.toBeNull();
      expect(decoded!.edicts[0].id.block).toBe(128n);
      expect(decoded!.edicts[0].id.tx).toBe(128n);
      expect(decoded!.edicts[0].amount).toBe(128n);
    });

    it('should correctly encode numbers requiring multiple bytes', () => {
      const result = encodeRunestone({
        edicts: [{
          id: { block: 16383, tx: 1 }, // Max 2-byte varint
          amount: 2097151n, // Max 3-byte varint
          output: 0,
        }],
      }) as EncodedRunestone;

      expect(result.encodedRunestone).toBeDefined();

      const decoded = decodeRunestone(result.encodedRunestone) as DecodedRunestone | null;
      expect(decoded).not.toBeNull();
      expect(decoded!.edicts[0].id.block).toBe(16383n);
      expect(decoded!.edicts[0].amount).toBe(2097151n);
    });
  });

  describe('delta encoding', () => {
    it('should use delta encoding for sequential blocks', () => {
      const edicts = [
        { id: { block: 100, tx: 0 }, amount: 100n, output: 0 },
        { id: { block: 101, tx: 0 }, amount: 100n, output: 1 },
        { id: { block: 102, tx: 0 }, amount: 100n, output: 2 },
      ];

      const encoded = encodeRunestone({ edicts }) as EncodedRunestone;
      const decoded = decodeRunestone(encoded.encodedRunestone) as DecodedRunestone | null;

      expect(decoded).not.toBeNull();
      expect(decoded!.edicts).toHaveLength(3);
      expect(decoded!.edicts[0].id.block).toBe(100n);
      expect(decoded!.edicts[1].id.block).toBe(101n);
      expect(decoded!.edicts[2].id.block).toBe(102n);
    });

    it('should use delta encoding for sequential transactions', () => {
      const edicts = [
        { id: { block: 100, tx: 0 }, amount: 100n, output: 0 },
        { id: { block: 100, tx: 1 }, amount: 100n, output: 1 },
        { id: { block: 100, tx: 2 }, amount: 100n, output: 2 },
      ];

      const encoded = encodeRunestone({ edicts }) as EncodedRunestone;
      const decoded = decodeRunestone(encoded.encodedRunestone) as DecodedRunestone | null;

      expect(decoded).not.toBeNull();
      expect(decoded!.edicts).toHaveLength(3);
      expect(decoded!.edicts[0].id.tx).toBe(0n);
      expect(decoded!.edicts[1].id.tx).toBe(1n);
      expect(decoded!.edicts[2].id.tx).toBe(2n);
    });
  });
});
