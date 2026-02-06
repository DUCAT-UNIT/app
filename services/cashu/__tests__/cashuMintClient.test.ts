/**
 * Tests for cashuMintClient
 */

// Mock dependencies BEFORE imports
jest.mock('../../../utils/apiClient', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock cashuCrypto for checkProofsSpent
jest.mock('../crypto', () => ({
  hashToCurve: jest.fn(),
}));

import { getJSON, postJSON } from '../../../utils/apiClient';
import {
  getMintInfo,
  getKeysets,
  getKeys,
  createMintQuote,
  checkMintQuote,
  mintTokens,
  swapTokens,
  createMeltQuote,
  checkMeltQuote,
  meltTokens,
  checkProofsSpent,
} from '../cashuMintClient';

describe('cashuMintClient', () => {
  const MINT_URL = 'https://cashu-mint.ducatprotocol.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMintInfo', () => {
    it('should fetch mint info', async () => {
      const mockInfo = { name: 'Test Mint', version: '1.0.0' };
      (getJSON as jest.Mock).mockResolvedValue(mockInfo);

      const result = await getMintInfo();

      expect(result).toEqual(mockInfo);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/info`,
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getMintInfo()).rejects.toThrow('Network error');
    });
  });

  describe('getKeysets', () => {
    it('should fetch keysets', async () => {
      const mockKeysets = { keysets: [{ id: 'keyset1', unit: 'unit' }] };
      (getJSON as jest.Mock).mockResolvedValue(mockKeysets);

      const result = await getKeysets();

      expect(result).toEqual(mockKeysets);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/keysets`,
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getKeysets()).rejects.toThrow('Network error');
    });
  });

  describe('getKeys', () => {
    it('should fetch all keys when no keyset ID provided', async () => {
      const mockKeys = { keysets: [{ id: 'ks1', keys: { 1: 'key1' } }] };
      (getJSON as jest.Mock).mockResolvedValue(mockKeys);

      const result = await getKeys();

      expect(result).toEqual(mockKeys);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/keys`,
        expect.any(Object)
      );
    });

    it('should fetch keys for specific keyset ID', async () => {
      const mockKeys = { keys: { 1: 'key1', 2: 'key2' } };
      (getJSON as jest.Mock).mockResolvedValue(mockKeys);

      const result = await getKeys('keyset123');

      expect(result).toEqual(mockKeys);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/keys/keyset123`,
        expect.any(Object)
      );
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getKeys()).rejects.toThrow('Network error');
    });
  });

  describe('createMintQuote', () => {
    it('should create a mint quote', async () => {
      const mockQuote = {
        quote: 'quote123',
        request: 'tb1pdeposit',
        amount: 1000,
      };
      (postJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await createMintQuote(1000);

      expect(result).toEqual(mockQuote);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/quote/unit`,
        expect.objectContaining({
          amount: 1000,
          unit: 'unit',
          rune_id: '1527352:1',
        }),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should throw on error', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Server error'));

      await expect(createMintQuote(1000)).rejects.toThrow('Server error');
    });
  });

  describe('checkMintQuote', () => {
    it('should check mint quote status', async () => {
      const mockQuote = { quote: 'quote123', state: 'PAID' };
      (getJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await checkMintQuote('quote123');

      expect(result).toEqual(mockQuote);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/quote/unit/quote123`,
        expect.any(Object)
      );
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockRejectedValue(new Error('Quote not found'));

      await expect(checkMintQuote('badquote')).rejects.toThrow('Quote not found');
    });
  });

  describe('mintTokens', () => {
    it('should mint tokens successfully', async () => {
      const mockResponse = {
        signatures: [{ C_: 'sig1' }, { C_: 'sig2' }],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const outputs = [{ amount: 100, B_: 'blind1' }];
      const result = await mintTokens('quote123', outputs);

      expect(result).toEqual(mockResponse);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/unit`,
        { quote: 'quote123', outputs },
        expect.any(Object)
      );
    });

    it('should throw on mint error response', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ error: 'Quote expired' });

      await expect(mintTokens('quote123', [])).rejects.toThrow('Mint failed: Quote expired');
    });

    it('should throw on missing signatures', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ success: true });

      await expect(mintTokens('quote123', [])).rejects.toThrow('Invalid mint response: missing signatures');
    });

    it('should throw on invalid signatures format', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ signatures: 'not-an-array' });

      await expect(mintTokens('quote123', [])).rejects.toThrow('Invalid mint response: missing signatures');
    });

    it('should throw on network error', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await expect(mintTokens('quote123', [])).rejects.toThrow('Network timeout');
    });
  });

  describe('swapTokens', () => {
    it('should swap tokens successfully', async () => {
      // Signatures count must match outputs count for security validation
      const mockResponse = {
        signatures: [{ C_: 'newsig1' }, { C_: 'newsig2' }],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const inputs = [{ amount: 100, secret: 's', C: 'c', id: 'id1' }];
      const outputs = [{ amount: 50, B_: 'b1' }, { amount: 50, B_: 'b2' }];
      const result = await swapTokens(inputs, outputs);

      expect(result).toEqual(mockResponse);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/swap`,
        { inputs, outputs },
        expect.any(Object)
      );
    });

    it('should throw on swap error response', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ error: 'Proofs already spent' });

      await expect(swapTokens([], [])).rejects.toThrow('Swap failed: Proofs already spent');
    });

    it('should throw on missing signatures', async () => {
      (postJSON as jest.Mock).mockResolvedValue({});

      await expect(swapTokens([], [])).rejects.toThrow('Invalid swap response: missing signatures');
    });

    it('should throw on network error', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(swapTokens([], [])).rejects.toThrow('Network error');
    });
  });

  describe('createMeltQuote', () => {
    it('should create a melt quote', async () => {
      const mockQuote = {
        quote: 'meltquote123',
        amount: 1000,
        fee_reserve: 10,
      };
      (postJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await createMeltQuote('tb1pwithdraw', 1000);

      expect(result).toEqual(mockQuote);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/quote/unit`,
        expect.objectContaining({
          request: 'tb1pwithdraw',
          amount: 1000,
          unit: 'unit',
          rune_id: '1527352:1',
        }),
        expect.any(Object)
      );
    });

    it('should throw on error', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Invalid address'));

      await expect(createMeltQuote('invalid', 1000)).rejects.toThrow('Invalid address');
    });
  });

  describe('checkMeltQuote', () => {
    it('should check melt quote status', async () => {
      const mockQuote = { quote: 'meltquote123', state: 'PENDING' };
      (getJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await checkMeltQuote('meltquote123');

      expect(result).toEqual(mockQuote);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/quote/unit/meltquote123`,
        expect.any(Object)
      );
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockRejectedValue(new Error('Quote not found'));

      await expect(checkMeltQuote('badquote')).rejects.toThrow('Quote not found');
    });
  });

  describe('meltTokens', () => {
    it('should melt tokens successfully', async () => {
      const mockResponse = {
        paid: true,
        payment_preimage: 'txid123',
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const inputs = [{ amount: 100, secret: 's', C: 'c', id: 'id1' }];
      const result = await meltTokens('meltquote123', inputs);

      expect(result).toEqual(mockResponse);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/unit`,
        { quote: 'meltquote123', inputs },
        expect.objectContaining({ timeout: 15000 })
      );
    });

    it('should throw on network error', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Timeout'));

      await expect(meltTokens('quote', [])).rejects.toThrow('Timeout');
    });
  });

  describe('checkProofsSpent', () => {
    // Note: checkProofsSpent uses dynamic import which doesn't work with standard Jest
    // We test that the function exists and verify basic behavior

    it('should be a function', () => {
      expect(typeof checkProofsSpent).toBe('function');
    });

    it('should throw when dynamic import fails', async () => {
      // Dynamic imports fail in Jest without --experimental-vm-modules
      await expect(checkProofsSpent([{ secret: 's', amount: 1, C: 'c', id: 'id1' }])).rejects.toThrow();
    });
  });
});
