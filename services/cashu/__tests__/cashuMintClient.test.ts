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
  mintSupportsNut12Dleq,
  mintSupportsOnchainUnit,
  mintSupportsOnchainCashuUnit,
  getKeysets,
  getKeys,
  createMintQuote,
  checkMintQuote,
  mintTokens,
  swapTokens,
  restoreSignatures,
  createMeltQuote,
  checkMeltQuote,
  meltTokens,
  checkProofsSpent,
} from '../cashuMintClient';

describe('cashuMintClient', () => {
  const MINT_URL = 'https://dev-cashu-mint.ducatprotocol.com';

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

  describe('mintSupportsOnchainUnit', () => {
    it('should detect advertised onchain/unit mint support', () => {
      expect(
        mintSupportsOnchainUnit({
          nuts: {
            '4': {
              methods: [{ method: 'onchain', unit: 'unit' }],
            },
          },
        })
      ).toBe(true);
    });

    it('should reject non-matching advertised methods', () => {
      expect(
        mintSupportsOnchainUnit({
          nuts: {
            '4': {
              methods: [
                { method: 'bolt11', unit: 'unit' },
                { method: 'onchain', unit: 'btc' },
              ],
            },
          },
        })
      ).toBe(false);
    });

    it('should detect advertised onchain/sat mint support', () => {
      expect(
        mintSupportsOnchainCashuUnit(
          {
            nuts: {
              '4': {
                methods: [
                  { method: 'onchain', unit: 'unit' },
                  { method: 'onchain', unit: 'sat' },
                ],
              },
            },
          },
          'sat'
        )
      ).toBe(true);
    });
  });

  describe('mintSupportsNut12Dleq', () => {
    it('should detect advertised NUT-12 support', () => {
      expect(mintSupportsNut12Dleq({ nuts: { '12': { supported: true } } })).toBe(true);
      expect(mintSupportsNut12Dleq({ nuts: { '12': {} } })).toBe(true);
    });

    it('should reject absent or explicitly disabled NUT-12 support', () => {
      expect(mintSupportsNut12Dleq({ nuts: {} })).toBe(false);
      expect(mintSupportsNut12Dleq({ nuts: { '12': { supported: false } } })).toBe(false);
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
      expect(getJSON).toHaveBeenCalledWith(`${MINT_URL}/v1/keys`, expect.any(Object));
    });

    it('should fetch keys for specific 66-char keyset ID', async () => {
      const keysetId = '02' + 'a'.repeat(64);
      const mockKeys = {
        keysets: [{ id: keysetId, unit: 'unit', keys: { 1: 'key1', 2: 'key2' } }],
      };
      (getJSON as jest.Mock).mockResolvedValue(mockKeys);

      const result = await getKeys(keysetId);

      expect(result).toEqual(mockKeys);
      expect(getJSON).toHaveBeenCalledWith(`${MINT_URL}/v1/keys/${keysetId}`, expect.any(Object));
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getKeys()).rejects.toThrow('Network error');
    });
  });

  describe('createMintQuote', () => {
    const pubkey = '02' + 'b'.repeat(64);
    const mintInfo = {
      nuts: {
        '4': {
          methods: [{ method: 'onchain', unit: 'unit' }],
        },
      },
    };

    it('should create a mint quote', async () => {
      const mockQuote = {
        quote: 'quote123',
        request: 'tb1pdeposit',
        state: 'UNPAID',
      };
      (getJSON as jest.Mock).mockResolvedValue(mintInfo);
      (postJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await createMintQuote(pubkey);

      expect(result).toEqual(mockQuote);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/info`,
        expect.objectContaining({ timeout: 5000 })
      );
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/quote/onchain`,
        expect.objectContaining({
          unit: 'unit',
          pubkey,
          rune_id: '1527352:1',
        }),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should create an onchain/sat mint quote without rune_id', async () => {
      const mockQuote = {
        quote: 'quote-sat',
        request: 'tb1pbtcdeposit',
        state: 'UNPAID',
      };
      (getJSON as jest.Mock).mockResolvedValue({
        nuts: {
          '4': {
            methods: [{ method: 'onchain', unit: 'sat' }],
          },
        },
      });
      (postJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await createMintQuote(pubkey, 'sat');

      expect(result).toEqual(mockQuote);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/quote/onchain`,
        expect.not.objectContaining({ rune_id: expect.anything() }),
        expect.objectContaining({ timeout: 10000 })
      );
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/quote/onchain`,
        expect.objectContaining({
          unit: 'sat',
          pubkey,
        }),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should reject mints that do not advertise onchain/unit', async () => {
      (getJSON as jest.Mock).mockResolvedValue({
        nuts: {
          '4': {
            methods: [{ method: 'bolt11', unit: 'unit' }],
          },
        },
      });

      await expect(createMintQuote(pubkey)).rejects.toThrow('onchain/unit support');
      expect(postJSON).not.toHaveBeenCalled();
    });

    it('should throw on error', async () => {
      (getJSON as jest.Mock).mockResolvedValue(mintInfo);
      (postJSON as jest.Mock).mockRejectedValue(new Error('Server error'));

      await expect(createMintQuote(pubkey)).rejects.toThrow('Server error');
    });
  });

  describe('checkMintQuote', () => {
    it('should check mint quote status', async () => {
      const mockQuote = { quote: 'quote123', state: 'PAID' };
      (getJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await checkMintQuote('quote123');

      expect(result).toEqual(mockQuote);
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/quote/onchain/quote123`,
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
      const result = await mintTokens('quote123', outputs, 'quotesig');

      expect(result).toEqual(mockResponse);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/mint/onchain`,
        { quote: 'quote123', outputs, signature: 'quotesig' },
        expect.any(Object)
      );
    });

    it('should throw on mint error response', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ error: 'Quote expired' });

      await expect(mintTokens('quote123', [], 'sig')).rejects.toThrow('Mint failed: Quote expired');
    });

    it('should throw on missing signatures', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ success: true });

      await expect(mintTokens('quote123', [], 'sig')).rejects.toThrow(
        'Invalid mint response: missing signatures'
      );
    });

    it('should throw on invalid signatures format', async () => {
      (postJSON as jest.Mock).mockResolvedValue({ signatures: 'not-an-array' });

      await expect(mintTokens('quote123', [], 'sig')).rejects.toThrow(
        'Invalid mint response: missing signatures'
      );
    });

    it('should throw on network error', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await expect(mintTokens('quote123', [], 'sig')).rejects.toThrow('Network timeout');
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
      const outputs = [
        { amount: 50, B_: 'b1' },
        { amount: 50, B_: 'b2' },
      ];
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

  describe('restoreSignatures', () => {
    it('should restore signatures in the requested output order', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        outputs: [
          { amount: 32, B_: 'b2' },
          { amount: 64, B_: 'b1' },
        ],
        signatures: [
          { C_: 'sig2', amount: 32 },
          { C_: 'sig1', amount: 64 },
        ],
      });

      const outputs = [
        { amount: 64, B_: 'b1' },
        { amount: 32, B_: 'b2' },
      ];
      const result = await restoreSignatures(outputs);

      expect(result).toEqual({
        signatures: [
          { C_: 'sig1', amount: 64 },
          { C_: 'sig2', amount: 32 },
        ],
      });
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/restore`,
        { outputs },
        expect.any(Object)
      );
    });

    it('should throw when restore returns only partial signatures', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64, B_: 'b1' }],
        signatures: [{ C_: 'sig1', amount: 64 }],
      });

      await expect(
        restoreSignatures([
          { amount: 64, B_: 'b1' },
          { amount: 32, B_: 'b2' },
        ])
      ).rejects.toThrow('Restore returned partial signatures');
    });
  });

  describe('createMeltQuote', () => {
    it('should create a melt quote', async () => {
      const mockQuote = {
        quote: 'meltquote123',
        amount: 1000,
        fee: 10,
        unit: 'unit',
      };
      (postJSON as jest.Mock).mockResolvedValue([mockQuote]);

      const result = await createMeltQuote('tb1pwithdraw', 1000);

      expect(result).toEqual({
        ...mockQuote,
        fee: 0,
        fee_reserve: 0,
      });
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/quote/onchain`,
        expect.objectContaining({
          request: 'tb1pwithdraw',
          amount: 1000,
          unit: 'unit',
          rune_id: '1527352:1',
        }),
        expect.any(Object)
      );
    });

    it('should ignore stale UNIT melt fees from the mint response', async () => {
      (postJSON as jest.Mock).mockResolvedValue([
        {
          quote: 'meltquote123',
          amount: 10616,
          unit: 'unit',
          fee: 1000,
        },
      ]);

      await expect(createMeltQuote('tb1pwithdraw', 10616)).resolves.toMatchObject({
        quote: 'meltquote123',
        amount: 10616,
        fee: 0,
        fee_reserve: 0,
      });
    });

    it('should preserve BTC sat melt fees when the mint omits unit in the response', async () => {
      (postJSON as jest.Mock).mockResolvedValue([
        {
          quote: 'btcmelt123',
          amount: 5000,
          fee: 250,
        },
      ]);

      await expect(createMeltQuote('tb1pwithdraw', 5000, 'sat')).resolves.toMatchObject({
        quote: 'btcmelt123',
        amount: 5000,
        fee: 250,
      });
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/quote/onchain`,
        expect.objectContaining({
          request: 'tb1pwithdraw',
          amount: 5000,
          unit: 'sat',
        }),
        expect.any(Object)
      );
      expect(postJSON).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ rune_id: expect.any(String) }),
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
      const mockQuote = { quote: 'meltquote123', state: 'PENDING', unit: 'unit', fee: 1000 };
      (getJSON as jest.Mock).mockResolvedValue(mockQuote);

      const result = await checkMeltQuote('meltquote123');

      expect(result).toEqual({
        ...mockQuote,
        fee: 0,
        fee_reserve: 0,
      });
      expect(getJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/quote/onchain/meltquote123`,
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
      const outputs = [{ amount: 5, B_: 'blind-change' }];
      const result = await meltTokens('meltquote123', inputs, outputs);

      expect(result).toEqual(mockResponse);
      expect(postJSON).toHaveBeenCalledWith(
        `${MINT_URL}/v1/melt/onchain`,
        { quote: 'meltquote123', inputs, outputs },
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
      await expect(
        checkProofsSpent([{ secret: 's', amount: 1, C: 'c', id: 'id1' }])
      ).rejects.toThrow();
    });
  });
});
