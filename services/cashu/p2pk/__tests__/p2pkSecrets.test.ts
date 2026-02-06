/**
 * Tests for P2PK Secrets (NUT-11)
 */

// Mock dependencies before imports
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

jest.mock('@noble/secp256k1', () => ({
  schnorr: {
    getPublicKey: jest.fn(),
  },
}));

jest.mock('../../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import * as crypto from 'expo-crypto';
import { schnorr } from '@noble/secp256k1';
import { generateP2PKKeyPair, createP2PKSecret } from '../p2pkSecrets';

describe('p2pkSecrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateP2PKKeyPair', () => {
    it('should generate a valid keypair', async () => {
      const mockPrivateKey = new Uint8Array(32).fill(1);
      const mockPublicKey = new Uint8Array(32).fill(2);

      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(mockPrivateKey);
      (schnorr.getPublicKey as jest.Mock).mockReturnValue(mockPublicKey);

      const result = await generateP2PKKeyPair();

      expect(result).toHaveProperty('privateKey');
      expect(result).toHaveProperty('publicKey');
      expect(result.privateKey).toBe('0101010101010101010101010101010101010101010101010101010101010101');
      expect(result.publicKey).toBe('0202020202020202020202020202020202020202020202020202020202020202');
    });

    it('should call getRandomBytesAsync with 32 bytes', async () => {
      const mockPrivateKey = new Uint8Array(32).fill(0);
      const mockPublicKey = new Uint8Array(32).fill(0);

      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(mockPrivateKey);
      (schnorr.getPublicKey as jest.Mock).mockReturnValue(mockPublicKey);

      await generateP2PKKeyPair();

      expect(crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    });
  });

  describe('createP2PKSecret', () => {
    const mockNonce = new Uint8Array(32).fill(0xab);

    beforeEach(() => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(mockNonce);
    });

    it('should create a basic P2PK secret with recipient pubkey', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey);
      const parsed = JSON.parse(result);

      expect(parsed[0]).toBe('P2PK');
      expect(parsed[1].data).toBe(recipientPubkey);
      expect(parsed[1].nonce).toBeDefined();
      expect(parsed[1].tags).toContainEqual(['sigflag', 'SIG_INPUTS']);
    });

    it('should use default SIG_INPUTS sigflag', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey);
      const parsed = JSON.parse(result);

      const sigflagTag = parsed[1].tags.find((t: string[]) => t[0] === 'sigflag');
      expect(sigflagTag).toEqual(['sigflag', 'SIG_INPUTS']);
    });

    it('should include custom sigflag when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey, { sigflag: 'SIG_ALL' });
      const parsed = JSON.parse(result);

      const sigflagTag = parsed[1].tags.find((t: string[]) => t[0] === 'sigflag');
      expect(sigflagTag).toEqual(['sigflag', 'SIG_ALL']);
    });

    it('should include additional pubkeys when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);
      const additionalPubkeys = ['pub1'.repeat(16), 'pub2'.repeat(16)];

      const result = await createP2PKSecret(recipientPubkey, { pubkeys: additionalPubkeys });
      const parsed = JSON.parse(result);

      const pubkeysTag = parsed[1].tags.find((t: string[]) => t[0] === 'pubkeys');
      expect(pubkeysTag).toEqual(['pubkeys', ...additionalPubkeys]);
    });

    it('should include n_sigs when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey, { n_sigs: 2 });
      const parsed = JSON.parse(result);

      const nSigsTag = parsed[1].tags.find((t: string[]) => t[0] === 'n_sigs');
      expect(nSigsTag).toEqual(['n_sigs', '2']);
    });

    it('should include locktime when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);
      const locktime = 1700000000;

      const result = await createP2PKSecret(recipientPubkey, { locktime });
      const parsed = JSON.parse(result);

      const locktimeTag = parsed[1].tags.find((t: string[]) => t[0] === 'locktime');
      expect(locktimeTag).toEqual(['locktime', locktime.toString()]);
    });

    it('should include refund pubkeys when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);
      const refundPubkeys = ['refund1'.repeat(10), 'refund2'.repeat(10)];

      const result = await createP2PKSecret(recipientPubkey, { refund: refundPubkeys });
      const parsed = JSON.parse(result);

      const refundTag = parsed[1].tags.find((t: string[]) => t[0] === 'refund');
      expect(refundTag).toEqual(['refund', ...refundPubkeys]);
    });

    it('should include n_sigs_refund when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey, { n_sigs_refund: 1 });
      const parsed = JSON.parse(result);

      const nSigsRefundTag = parsed[1].tags.find((t: string[]) => t[0] === 'n_sigs_refund');
      expect(nSigsRefundTag).toEqual(['n_sigs_refund', '1']);
    });

    it('should include all options when provided', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);
      const options = {
        sigflag: 'SIG_ALL',
        pubkeys: ['pub1'.repeat(16)],
        n_sigs: 2,
        locktime: 1700000000,
        refund: ['refund1'.repeat(10)],
        n_sigs_refund: 1,
      };

      const result = await createP2PKSecret(recipientPubkey, options);
      const parsed = JSON.parse(result);

      expect(parsed[1].tags.length).toBe(6);
    });

    it('should not include empty pubkeys array', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey, { pubkeys: [] });
      const parsed = JSON.parse(result);

      const pubkeysTag = parsed[1].tags.find((t: string[]) => t[0] === 'pubkeys');
      expect(pubkeysTag).toBeUndefined();
    });

    it('should not include empty refund array', async () => {
      const recipientPubkey = 'deadbeef'.repeat(8);

      const result = await createP2PKSecret(recipientPubkey, { refund: [] });
      const parsed = JSON.parse(result);

      const refundTag = parsed[1].tags.find((t: string[]) => t[0] === 'refund');
      expect(refundTag).toBeUndefined();
    });
  });
});
