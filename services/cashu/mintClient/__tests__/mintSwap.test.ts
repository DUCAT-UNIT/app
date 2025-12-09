// @ts-nocheck
/**
 * Tests for Mint Swap Service
 * Covers swapTokens and checkProofsSpent including error handling
 */

import { postJSON } from '../../../../utils/apiClient';
import { logger } from '../../../../utils/logger';

// Mock dependencies
jest.mock('../../../../utils/apiClient', () => ({
  postJSON: jest.fn(),
}));

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../mintConfig', () => ({
  MINT_URL: 'https://test-mint.example.com',
}));

// Mock crypto for checkProofsSpent
jest.mock('../../crypto', () => ({
  hashToCurve: jest.fn(),
}));

// Import after mocks
import { hashToCurve } from '../../crypto';
import { swapTokens, checkProofsSpent } from '../mintSwap';

describe('Mint Swap Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('swapTokens', () => {
    const mockInputs = [
      { amount: 100, secret: 's1', C: 'c1', id: 'id1' },
    ];
    const mockOutputs = [
      { amount: 50, B_: 'b1' },
      { amount: 50, B_: 'b2' },
    ];

    it('should swap tokens successfully', async () => {
      const mockResponse = {
        signatures: [{ C_: 'sig1' }, { C_: 'sig2' }],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const result = await swapTokens(mockInputs, mockOutputs);

      expect(result).toEqual(mockResponse);
      expect(postJSON).toHaveBeenCalledWith(
        'https://test-mint.example.com/v1/swap',
        { inputs: mockInputs, outputs: mockOutputs },
        expect.objectContaining({
          timeout: 10000,
          description: 'Swap tokens',
        })
      );
      expect(logger.info).toHaveBeenCalledWith('Swapping tokens', {
        inputCount: 1,
        outputCount: 2,
      });
      expect(logger.info).toHaveBeenCalledWith('Tokens swapped', { signatureCount: 2 });
    });

    it('should throw error if response contains error field', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        error: 'Proofs already spent',
      });

      await expect(swapTokens(mockInputs, mockOutputs)).rejects.toThrow(
        'Swap failed: Proofs already spent'
      );

      expect(logger.error).toHaveBeenCalledWith('Failed to swap tokens', {
        error: 'Swap failed: Proofs already spent',
      });
    });

    it('should throw error if signatures are missing', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        success: true,
      });

      await expect(swapTokens(mockInputs, mockOutputs)).rejects.toThrow(
        'Invalid swap response: missing signatures'
      );
    });

    it('should throw error if signatures is not an array', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        signatures: 'not-an-array',
      });

      await expect(swapTokens(mockInputs, mockOutputs)).rejects.toThrow(
        'Invalid swap response: missing signatures'
      );
    });

    it('should throw error if signatures is null', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        signatures: null,
      });

      await expect(swapTokens(mockInputs, mockOutputs)).rejects.toThrow(
        'Invalid swap response: missing signatures'
      );
    });

    it('should throw error on network failure', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await expect(swapTokens(mockInputs, mockOutputs)).rejects.toThrow('Network timeout');

      expect(logger.error).toHaveBeenCalledWith('Failed to swap tokens', {
        error: 'Network timeout',
      });
    });

    it('should handle empty inputs array', async () => {
      // With empty inputs but outputs, the mint should return matching signatures
      const mockResponse = { signatures: [{ C_: 'sig1' }, { C_: 'sig2' }] };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const result = await swapTokens([], mockOutputs);

      expect(result).toEqual(mockResponse);
      expect(logger.info).toHaveBeenCalledWith('Swapping tokens', {
        inputCount: 0,
        outputCount: 2,
      });
    });

    it('should handle empty outputs array', async () => {
      const mockResponse = { signatures: [] };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const result = await swapTokens(mockInputs, []);

      expect(result).toEqual(mockResponse);
      expect(logger.info).toHaveBeenCalledWith('Swapping tokens', {
        inputCount: 1,
        outputCount: 0,
      });
    });

    it('should log signature count on success', async () => {
      // Signatures count must match outputs count
      const mockResponse = {
        signatures: [{ C_: '1' }, { C_: '2' }],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      await swapTokens(mockInputs, mockOutputs);

      expect(logger.info).toHaveBeenCalledWith('Tokens swapped', {
        signatureCount: 2,
      });
    });

    it('should throw error if signatures count does not match outputs count', async () => {
      const mockResponse = {
        signatures: [{ C_: '1' }, { C_: '2' }, { C_: '3' }],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      await expect(swapTokens(mockInputs, mockOutputs)).rejects.toThrow(
        'Signature count mismatch: expected 2 signatures but got 3'
      );
    });
  });

  describe('checkProofsSpent', () => {
    const mockProofs = [
      { amount: 100, secret: 's1', C: 'c1', id: 'id1' },
      { amount: 50, secret: 's2', C: 'c2', id: 'id2' },
    ];

    beforeEach(() => {
      (hashToCurve as jest.Mock).mockImplementation(
        (secret) => Promise.resolve(`Y_${secret}`)
      );
    });

    it('should check proof states successfully', async () => {
      const mockResponse = {
        states: [
          { Y: 'Y_s1', state: 'UNSPENT' },
          { Y: 'Y_s2', state: 'SPENT' },
        ],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkProofsSpent(mockProofs);

      expect(result).toEqual(mockResponse);
      expect(hashToCurve).toHaveBeenCalledWith('s1');
      expect(hashToCurve).toHaveBeenCalledWith('s2');
      expect(postJSON).toHaveBeenCalledWith(
        'https://test-mint.example.com/v1/checkstate',
        { Ys: ['Y_s1', 'Y_s2'] },
        expect.objectContaining({
          timeout: 5000,
          description: 'Check proof state',
        })
      );
    });

    it('should hash all secrets to Y values', async () => {
      const mockResponse = { states: [] };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      await checkProofsSpent(mockProofs);

      expect(hashToCurve).toHaveBeenCalledTimes(2);
      expect(hashToCurve).toHaveBeenCalledWith('s1');
      expect(hashToCurve).toHaveBeenCalledWith('s2');
    });

    it('should handle empty proofs array', async () => {
      const mockResponse = { states: [] };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkProofsSpent([]);

      expect(result).toEqual(mockResponse);
      expect(hashToCurve).not.toHaveBeenCalled();
      expect(postJSON).toHaveBeenCalledWith(
        'https://test-mint.example.com/v1/checkstate',
        { Ys: [] },
        expect.any(Object)
      );
    });

    it('should throw error on network failure', async () => {
      (postJSON as jest.Mock).mockRejectedValue(new Error('Connection error'));

      await expect(checkProofsSpent(mockProofs)).rejects.toThrow('Connection error');

      expect(logger.error).toHaveBeenCalledWith('Failed to check proof state', {
        error: 'Connection error',
      });
    });

    it('should throw error if hashToCurve fails', async () => {
      (hashToCurve as jest.Mock).mockRejectedValue(new Error('Hash failed'));

      await expect(checkProofsSpent(mockProofs)).rejects.toThrow('Hash failed');
    });

    it('should handle states with witness field', async () => {
      const mockResponse = {
        states: [
          { Y: 'Y_s1', state: 'UNSPENT', witness: 'witness_data' },
        ],
      };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkProofsSpent([mockProofs[0]]);

      expect(result.states[0].witness).toBe('witness_data');
    });

    it('should use 5 second timeout for check state', async () => {
      const mockResponse = { states: [] };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      await checkProofsSpent(mockProofs);

      const callArgs = (postJSON as jest.Mock).mock.calls[0];
      expect(callArgs[2].timeout).toBe(5000);
    });

    it('should pass correct description to postJSON', async () => {
      const mockResponse = { states: [] };
      (postJSON as jest.Mock).mockResolvedValue(mockResponse);

      await checkProofsSpent(mockProofs);

      const callArgs = (postJSON as jest.Mock).mock.calls[0];
      expect(callArgs[2].description).toBe('Check proof state');
    });
  });

  describe('error handling edge cases', () => {
    it('swapTokens should handle response with both error and signatures', async () => {
      // If response has error field, it should throw regardless of signatures
      (postJSON as jest.Mock).mockResolvedValue({
        error: 'Some error',
        signatures: [{ C_: 'sig1' }],
      });

      await expect(swapTokens([], [])).rejects.toThrow('Swap failed: Some error');
    });

    it('swapTokens should validate signatures is array before checking length', async () => {
      (postJSON as jest.Mock).mockResolvedValue({
        signatures: {},
      });

      await expect(swapTokens([], [])).rejects.toThrow('Invalid swap response: missing signatures');
    });

    it('checkProofsSpent should handle malformed response', async () => {
      (postJSON as jest.Mock).mockResolvedValue(null);

      // Should not throw on malformed response, just return it
      const result = await checkProofsSpent([]);

      expect(result).toBeNull();
    });
  });
});
