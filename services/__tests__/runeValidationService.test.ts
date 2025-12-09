/**
 * Tests for Rune Validation Service
 * Critical security validation to prevent fund loss
 */

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    security: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock constants
jest.mock('../../utils/constants', () => ({
  API: {
    ORD_MUTINYNET_BASE: 'https://ord-test.com',
  },
  RUNES_CONFIG: {
    DUCAT_UNIT_RUNE_ID: {
      block: 123456n,
      tx: 789,
    },
    DUCAT_UNIT_RUNE_LABEL: 'DUCAT•UNIT•RUNE',
  },
}));

import { validateRuneConfiguration, getRuneIdString } from '../runeValidationService';
import { logger } from '../../utils/logger';

describe('runeValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateRuneConfiguration', () => {
    it('should validate successfully when rune data matches configuration', async () => {
      const mockRuneInfo = {
        id: '123456:789',
        spaced_rune: 'DUCAT•UNIT•RUNE',
        number: 1,
        rune: 'DUCATUNITRUNE',
        block: 123456,
        txIndex: 789,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRuneInfo),
      });

      const result = await validateRuneConfiguration();

      expect(result).toBe(true);
      expect(logger.security).toHaveBeenCalledWith(
        'Validating Rune configuration',
        expect.objectContaining({
          configuredBlock: '123456',
          configuredTx: '789',
          expectedLabel: 'DUCAT•UNIT•RUNE',
        })
      );
      expect(logger.security).toHaveBeenCalledWith(
        'Rune configuration validated successfully',
        expect.objectContaining({
          label: 'DUCAT•UNIT•RUNE',
          runeId: '123456:789',
          block: 123456,
          txIndex: 789,
        })
      );
    });

    it('should return true with warning when API is unavailable', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await validateRuneConfiguration();

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Rune validation API unavailable',
        expect.objectContaining({
          status: 404,
          recommendation: 'Verify rune ID manually: https://ord-mutinynet.ducatprotocol.com',
        })
      );
    });

    it('should throw critical error when rune label does not match', async () => {
      const mockRuneInfo = {
        id: '123456:789',
        spaced_rune: 'WRONG•RUNE•LABEL',
        number: 1,
        rune: 'WRONGRUNELABEL',
        block: 123456,
        txIndex: 789,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRuneInfo),
      });

      await expect(validateRuneConfiguration()).rejects.toThrow('CRITICAL: Rune configuration mismatch!');
      await expect(validateRuneConfiguration()).rejects.toThrow('Expected label: DUCAT•UNIT•RUNE');
      await expect(validateRuneConfiguration()).rejects.toThrow('Actual label: WRONG•RUNE•LABEL');

      expect(logger.error).toHaveBeenCalledWith(
        'RUNE CONFIGURATION MISMATCH',
        expect.objectContaining({
          expectedLabel: 'DUCAT•UNIT•RUNE',
          actualLabel: 'WRONG•RUNE•LABEL',
          severity: 'CRITICAL',
        })
      );
    });

    it('should throw critical error when block number does not match', async () => {
      const mockRuneInfo = {
        id: '999999:789',
        spaced_rune: 'DUCAT•UNIT•RUNE',
        number: 1,
        rune: 'DUCATUNITRUNE',
        block: 999999, // Wrong block
        txIndex: 789,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRuneInfo),
      });

      await expect(validateRuneConfiguration()).rejects.toThrow('CRITICAL: Rune ID mismatch!');
      await expect(validateRuneConfiguration()).rejects.toThrow('Expected: block 123456, tx 789');
      await expect(validateRuneConfiguration()).rejects.toThrow('Actual: block 999999, tx 789');

      expect(logger.error).toHaveBeenCalledWith(
        'RUNE ID MISMATCH',
        expect.objectContaining({
          expectedBlock: '123456',
          actualBlock: 999999,
          expectedTx: '789',
          actualTx: 789,
          severity: 'CRITICAL',
        })
      );
    });

    it('should throw critical error when tx index does not match', async () => {
      const mockRuneInfo = {
        id: '123456:999',
        spaced_rune: 'DUCAT•UNIT•RUNE',
        number: 1,
        rune: 'DUCATUNITRUNE',
        block: 123456,
        txIndex: 999, // Wrong tx index
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRuneInfo),
      });

      await expect(validateRuneConfiguration()).rejects.toThrow('CRITICAL: Rune ID mismatch!');
      await expect(validateRuneConfiguration()).rejects.toThrow('Expected: block 123456, tx 789');
      await expect(validateRuneConfiguration()).rejects.toThrow('Actual: block 123456, tx 999');

      expect(logger.error).toHaveBeenCalledWith(
        'RUNE ID MISMATCH',
        expect.objectContaining({
          expectedBlock: '123456',
          actualBlock: 123456,
          expectedTx: '789',
          actualTx: 999,
          severity: 'CRITICAL',
        })
      );
    });

    it('should return true with warning on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await validateRuneConfiguration();

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Rune validation failed (network error)',
        expect.objectContaining({
          error: 'Network error',
          recommendation: 'Verify rune ID manually before proceeding with transactions',
        })
      );
    });

    it('should return true with warning on fetch timeout', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      const result = await validateRuneConfiguration();

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Rune validation failed (network error)',
        expect.objectContaining({
          error: 'Request timeout',
        })
      );
    });

    it('should return true with warning on JSON parse error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await validateRuneConfiguration();

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Rune validation failed (network error)',
        expect.objectContaining({
          error: 'Invalid JSON',
        })
      );
    });

    it('should re-throw critical configuration errors', async () => {
      const mockRuneInfo = {
        id: '123456:789',
        spaced_rune: 'WRONG•LABEL',
        number: 1,
        rune: 'WRONGLABEL',
        block: 123456,
        txIndex: 789,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRuneInfo),
      });

      await expect(validateRuneConfiguration()).rejects.toThrow('CRITICAL:');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue('String error');

      const result = await validateRuneConfiguration();

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Rune validation failed (network error)',
        expect.objectContaining({
          error: 'String error',
        })
      );
    });

    it('should call fetch with correct URL and headers', async () => {
      const mockRuneInfo = {
        id: '123456:789',
        spaced_rune: 'DUCAT•UNIT•RUNE',
        number: 1,
        rune: 'DUCATUNITRUNE',
        block: 123456,
        txIndex: 789,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRuneInfo),
      });

      await validateRuneConfiguration();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://ord-test.com/rune/123456:789',
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
          },
        })
      );
    });
  });

  describe('getRuneIdString', () => {
    it('should return formatted rune ID string with label', () => {
      const result = getRuneIdString();

      expect(result).toBe('123456:789 (DUCAT•UNIT•RUNE)');
    });

    it('should handle bigint block number correctly', () => {
      const result = getRuneIdString();

      // Verify it includes the block number as a string
      expect(result).toContain('123456');
      expect(result).toContain('789');
      expect(result).toContain('DUCAT•UNIT•RUNE');
    });
  });
});
