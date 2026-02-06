/**
 * Tests for Wallet API
 */

import { createMobileWalletAPI } from '../walletApi';
import { OracleAPI } from '@ducat-unit/client-sdk';
import { TX, PSBT } from '@ducat-unit/client-sdk/util';
import * as signing from '../../signing';
import { Buffer } from 'buffer';

// Mock dependencies
jest.mock('@ducat-unit/client-sdk', () => ({
  OracleAPI: {
    wallet: {
      fetch_address_bal: jest.fn(),
      fetch_rune_utxos: jest.fn(),
      fetch_vault_tokens: jest.fn(),
    },
    esplora: {
      esplora_get_utxos: jest.fn(),
    },
  },
}));

jest.mock('@ducat-unit/client-sdk/util', () => ({
  TX: {
    parse_address: jest.fn(() => ({ hex: '001400112233' })),
    parse_script_meta: jest.fn(() => ({
      type: 'p2w-pkh',
      key: { hex: 'abc123' }
    })),
  },
  PSBT: {
    decode: jest.fn(),
    encode: jest.fn(),
  },
  hash160: jest.fn(() => 'abc123'),
  taptweak_pubkey: jest.fn(() => 'def456'),
}));

jest.mock('../../signing', () => ({
  signPsbtRaw: jest.fn(),
  signPsbtWithSdkObject: jest.fn(),
  patchPreProcessFields: jest.fn((psbt) => psbt),
  patchPostProcessFields: jest.fn((psbt) => psbt),
  psbtPreProcess: jest.fn(),
  psbtPostProcess: jest.fn(),
}));

jest.mock('../psbtBinaryUtils', () => ({
  extractOpReturnFromPsbt: jest.fn(() => 'mock-op-return'),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/constants', () => ({
  API: {
    ESPLORA_URL: 'https://test-esplora',
    ORD_URL: 'https://test-ord',
  },
}));

describe('walletApi', () => {
  const mockClient = {
    acct: {
      sats: {
        address: 'tb1qtest123',
        pubkey: '02aabbcc',
      },
      runes: {
        address: 'tb1ptest456',
        pubkey: '03ddeeff',
      },
      vault: {
        address: 'tb1pvault789',
        pubkey: '04aabbcc',
      },
    },
    config: {
      postage: {
        vault: 1000,
      },
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMobileWalletAPI', () => {
    it('should create wallet API with all methods', () => {
      const api = createMobileWalletAPI('tb1qtest');

      expect(api).toBeDefined();
      expect(api.fetch).toBeDefined();
      expect(api.sign).toBeDefined();
      expect(api.fetch.balance).toBeDefined();
      expect(api.fetch.sats_utxos).toBeDefined();
      expect(api.fetch.rune_utxos).toBeDefined();
      expect(api.fetch.vault_tokens).toBeDefined();
      expect(api.sign.psbt).toBeDefined();
      expect(api.sign.utxos).toBeDefined();
      expect(api.sign.batch).toBeDefined();
    });

    describe('fetch.balance', () => {
      it('should fetch address balance successfully', async () => {
        const mockBalance = { confirmed: 100000, unconfirmed: 0 };
        (OracleAPI.wallet.fetch_address_bal as jest.Mock).mockResolvedValue({
          ok: true,
          data: mockBalance,
        });

        const api = createMobileWalletAPI('tb1qtest');
        const balance = await api.fetch.balance(mockClient)();

        expect(OracleAPI.wallet.fetch_address_bal).toHaveBeenCalledWith(
          'https://test-ord',
          'tb1qtest'
        );
        expect(balance).toEqual(mockBalance);
      });

      it('should throw error on failed balance fetch', async () => {
        (OracleAPI.wallet.fetch_address_bal as jest.Mock).mockResolvedValue({
          ok: false,
          error: 'Network error',
        });

        const api = createMobileWalletAPI('tb1qtest');

        await expect(api.fetch.balance(mockClient)()).rejects.toThrow('Network error');
      });
    });

    describe('fetch.sats_utxos', () => {
      it('should fetch sats UTXOs successfully', async () => {
        const mockUtxos = [
          { txid: 'abc123', vout: 0, value: 50000 },
          { txid: 'def456', vout: 1, value: 25000 },
        ];
        (OracleAPI.esplora.esplora_get_utxos as jest.Mock).mockResolvedValue({
          ok: true,
          data: mockUtxos,
        });

        const api = createMobileWalletAPI('tb1qtest');
        const utxos = await api.fetch.sats_utxos(mockClient)();

        expect(OracleAPI.esplora.esplora_get_utxos).toHaveBeenCalledWith(
          'https://test-esplora',
          'tb1qtest123'
        );
        expect(utxos).toEqual([
          { txid: 'abc123', vout: 0, value: 50000, script: '001400112233' },
          { txid: 'def456', vout: 1, value: 25000, script: '001400112233' },
        ]);
      });

      it('should throw error on failed utxos fetch', async () => {
        (OracleAPI.esplora.esplora_get_utxos as jest.Mock).mockResolvedValue({
          ok: false,
          error: 'UTXO fetch failed',
        });

        const api = createMobileWalletAPI('tb1qtest');

        await expect(api.fetch.sats_utxos(mockClient)()).rejects.toThrow('UTXO fetch failed');
      });
    });

    describe('fetch.rune_utxos', () => {
      it('should fetch rune UTXOs successfully', async () => {
        const mockRuneUtxos = [{ txid: 'rune123', vout: 0, value: 10000 }];
        (OracleAPI.wallet.fetch_rune_utxos as jest.Mock).mockResolvedValue({
          ok: true,
          data: mockRuneUtxos,
        });

        const api = createMobileWalletAPI('tb1qtest');
        const utxos = await api.fetch.rune_utxos(mockClient)();

        expect(OracleAPI.wallet.fetch_rune_utxos).toHaveBeenCalledWith(
          'https://test-ord',
          'tb1ptest456'
        );
        expect(utxos).toEqual(mockRuneUtxos);
      });

      it('should throw error on failed rune utxos fetch', async () => {
        (OracleAPI.wallet.fetch_rune_utxos as jest.Mock).mockResolvedValue({
          ok: false,
          error: 'Rune fetch failed',
        });

        const api = createMobileWalletAPI('tb1qtest');

        await expect(api.fetch.rune_utxos(mockClient)()).rejects.toThrow('Rune fetch failed');
      });
    });

    describe('fetch.vault_tokens', () => {
      it('should fetch vault tokens successfully', async () => {
        const mockTokens = [{ token_id: 'token1', amount: 1000 }];
        (OracleAPI.wallet.fetch_vault_tokens as jest.Mock).mockResolvedValue({
          ok: true,
          data: mockTokens,
        });

        const api = createMobileWalletAPI('tb1qtest');
        const tokens = await api.fetch.vault_tokens(mockClient)();

        expect(OracleAPI.wallet.fetch_vault_tokens).toHaveBeenCalledWith(
          'https://test-esplora',
          'https://test-ord',
          'tb1pvault789',
          1000
        );
        expect(tokens).toEqual(mockTokens);
      });

      it('should throw error on failed vault tokens fetch', async () => {
        (OracleAPI.wallet.fetch_vault_tokens as jest.Mock).mockResolvedValue({
          ok: false,
          error: 'Token fetch failed',
        });

        const api = createMobileWalletAPI('tb1qtest');

        await expect(api.fetch.vault_tokens(mockClient)()).rejects.toThrow('Token fetch failed');
      });
    });

    describe('sign.psbt', () => {
      it('should sign PSBT with pre/post processing', async () => {
        const mockPsbt = 'cHNidP8BAA==';
        const mockManifest = { 'tb1qtest': [0, 1] };
        const mockPdata = {
          inputsLength: 2,
          getInput: jest.fn((i) => ({
            witnessUtxo: {
              script: Buffer.from('0014abc123', 'hex'),
            },
            tapLeafScript: undefined,
          })),
        };
        const mockSignedPsbt = 'cHNidP8SIGNED==';

        (PSBT.decode as jest.Mock).mockReturnValue(mockPdata);
        (PSBT.encode as jest.Mock).mockReturnValue(mockSignedPsbt);
        (signing.signPsbtRaw as jest.Mock).mockResolvedValue(mockSignedPsbt);

        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.psbt(mockClient)(mockPsbt, mockManifest);

        expect(PSBT.decode).toHaveBeenCalledWith(mockPsbt);
        expect(signing.psbtPreProcess).toHaveBeenCalledWith(mockClient, mockPdata, mockManifest);
        expect(signing.signPsbtRaw).toHaveBeenCalled();
        expect(signing.psbtPostProcess).toHaveBeenCalled();
        expect(result).toBe(mockSignedPsbt);
      });
    });

    describe('sign.utxos', () => {
      it('should sign UTXOs by building manifest', async () => {
        const mockPsbt = 'cHNidP8BAA==';
        const mockPdata = {
          inputsLength: 2,
          getInput: jest.fn((i) => ({
            witnessUtxo: {
              script: Buffer.from('0014abc123', 'hex'),
            },
          })),
        };
        const mockSignedPsbt = 'cHNidP8SIGNED==';

        (PSBT.decode as jest.Mock).mockReturnValue(mockPdata);
        (PSBT.encode as jest.Mock).mockReturnValue(mockSignedPsbt);
        (signing.signPsbtRaw as jest.Mock).mockResolvedValue(mockSignedPsbt);
        (TX.parse_script_meta as jest.Mock).mockReturnValue({
          type: 'p2w-pkh',
          key: { hex: 'abc123' },
        });

        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.utxos(mockClient)(mockPsbt);

        expect(PSBT.decode).toHaveBeenCalledWith(mockPsbt);
        expect(signing.psbtPreProcess).toHaveBeenCalled();
        expect(signing.signPsbtRaw).toHaveBeenCalled();
        expect(signing.psbtPostProcess).toHaveBeenCalled();
        expect(result).toBe(mockSignedPsbt);
      });

      it('should skip inputs without witnessUtxo', async () => {
        const mockPsbt = 'cHNidP8BAA==';
        const mockPdata = {
          inputsLength: 2,
          getInput: jest.fn((i) => ({
            witnessUtxo: i === 0 ? { script: Buffer.from('0014abc123', 'hex') } : undefined,
          })),
        };
        const mockSignedPsbt = 'cHNidP8SIGNED==';

        (PSBT.decode as jest.Mock).mockReturnValue(mockPdata);
        (PSBT.encode as jest.Mock).mockReturnValue(mockSignedPsbt);
        (signing.signPsbtRaw as jest.Mock).mockResolvedValue(mockSignedPsbt);

        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.utxos(mockClient)(mockPsbt);

        expect(result).toBe(mockSignedPsbt);
      });

      it('should handle taproot inputs', async () => {
        const mockPsbt = 'cHNidP8BAA==';
        const mockPdata = {
          inputsLength: 1,
          getInput: jest.fn(() => ({
            witnessUtxo: {
              script: Buffer.from('5120def456', 'hex'),
            },
          })),
        };
        const mockSignedPsbt = 'cHNidP8SIGNED==';

        (PSBT.decode as jest.Mock).mockReturnValue(mockPdata);
        (PSBT.encode as jest.Mock).mockReturnValue(mockSignedPsbt);
        (signing.signPsbtRaw as jest.Mock).mockResolvedValue(mockSignedPsbt);
        (TX.parse_script_meta as jest.Mock).mockReturnValue({
          type: 'p2tr',
          key: { hex: 'def456' },
        });

        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.utxos(mockClient)(mockPsbt);

        expect(result).toBe(mockSignedPsbt);
      });
    });

    describe('sign.batch', () => {
      it('should sign multiple PSBTs in batch', async () => {
        const mockPsbts: [string, Record<string, number[]>][] = [
          ['cHNidP8BAA==', { 'tb1qtest': [0] }],
          ['cHNidP8BBB==', { 'tb1qtest': [0, 1] }],
        ];
        const mockPdata = {};
        const mockSignedPsbt = 'cHNidP8SIGNED==';

        (PSBT.decode as jest.Mock).mockReturnValue(mockPdata);
        (signing.patchPreProcessFields as jest.Mock).mockImplementation((psbt) => psbt);
        (signing.signPsbtWithSdkObject as jest.Mock).mockResolvedValue(mockSignedPsbt);
        (signing.patchPostProcessFields as jest.Mock).mockImplementation((psbt) => psbt);

        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.batch!(mockClient)(mockPsbts);

        expect(result).toHaveLength(2);
        expect(signing.patchPreProcessFields).toHaveBeenCalledTimes(2);
        expect(signing.signPsbtWithSdkObject).toHaveBeenCalledTimes(2);
        expect(signing.patchPostProcessFields).toHaveBeenCalledTimes(2); // Only first 2 PSBTs
      });

      it('should only post-process first 2 PSBTs', async () => {
        const mockPsbts: [string, Record<string, number[]>][] = [
          ['cHNidP8BAA==', { 'tb1qtest': [0] }],
          ['cHNidP8BBB==', { 'tb1qtest': [0] }],
          ['cHNidP8CCC==', { 'tb1qtest': [0] }],
        ];
        const mockPdata = {};
        const mockSignedPsbt = 'cHNidP8SIGNED==';

        (PSBT.decode as jest.Mock).mockReturnValue(mockPdata);
        (signing.patchPreProcessFields as jest.Mock).mockImplementation((psbt) => psbt);
        (signing.signPsbtWithSdkObject as jest.Mock).mockResolvedValue(mockSignedPsbt);
        (signing.patchPostProcessFields as jest.Mock).mockImplementation((psbt) => psbt);

        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.batch!(mockClient)(mockPsbts);

        expect(result).toHaveLength(3);
        expect(signing.patchPostProcessFields).toHaveBeenCalledTimes(2); // Only first 2
      });

      it('should handle empty batch', async () => {
        const api = createMobileWalletAPI('tb1qtest');
        const result = await api.sign.batch!(mockClient)([]);

        expect(result).toEqual([]);
      });
    });
  });
});
