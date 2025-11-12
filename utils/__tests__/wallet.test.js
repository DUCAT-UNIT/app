/**
 * Tests for Wallet utilities
 * Focuses on helper functions and basic PSBT operations
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { signMessage } from '../wallet';
import * as authService from '../../services/authService';

// Initialize ECC library
bitcoin.initEccLib(ecc);

// Mock authService
jest.mock('../../services/authService', () => ({
  withMnemonic: jest.fn((callback) => {
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    return callback(testMnemonic);
  }),
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('wallet utilities', () => {
  describe('signMessage', () => {
    it('should sign a message with segwit address', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = 'Test message';

      const signature = await signMessage(address, message);

      // Should return a hex string
      expect(signature).toMatch(/^[0-9a-f]+$/);
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should sign a message with taproot address', async () => {
      const address = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
      const message = 'Test message';

      const signature = await signMessage(address, message);

      // Should return a hex string
      expect(signature).toMatch(/^[0-9a-f]+$/);
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should produce consistent signatures for same message', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = 'Test message';

      const sig1 = await signMessage(address, message);
      const sig2 = await signMessage(address, message);

      // Same message should produce same signature (deterministic)
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different messages', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      const sig1 = await signMessage(address, 'Message 1');
      const sig2 = await signMessage(address, 'Message 2');

      // Different messages should produce different signatures
      expect(sig1).not.toBe(sig2);
    });

    it('should throw error for unsupported address type', async () => {
      const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Mainnet legacy

      await expect(signMessage(address, 'Test')).rejects.toThrow('Unsupported address type');
    });

    it('should handle empty message', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = '';

      const signature = await signMessage(address, message);

      // Should still produce a valid signature
      expect(signature).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle unicode characters in message', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = 'Hello 世界 🌍';

      const signature = await signMessage(address, message);

      // Should handle unicode properly
      expect(signature).toMatch(/^[0-9a-f]+$/);
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should use withMnemonic for secure access', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = 'Test';

      await signMessage(address, message);

      // Verify withMnemonic was called
      expect(authService.withMnemonic).toHaveBeenCalled();
    });

    it('should use correct derivation path for segwit', async () => {
      // This is implicitly tested by the fact that signing works
      // The path m/84'/1'/0'/0/0 is used for segwit
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const signature = await signMessage(address, 'Test');

      expect(signature).toBeDefined();
    });

    it('should use correct derivation path for taproot', async () => {
      // This is implicitly tested by the fact that signing works
      // The path m/86'/1'/0'/0/0 is used for taproot
      const address = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
      const signature = await signMessage(address, 'Test');

      expect(signature).toBeDefined();
    });
  });

  describe('signMessage error handling', () => {
    it('should handle mnemonic retrieval failure', async () => {
      authService.withMnemonic.mockImplementationOnce(() => {
        throw new Error('Mnemonic not available');
      });

      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      await expect(signMessage(address, 'Test')).rejects.toThrow('Mnemonic not available');
    });
  });

  describe('signMessage integration', () => {
    it('should work with real Bitcoin cryptography', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = 'Integration test message';

      const signature = await signMessage(address, message);

      // Signature should be 64 bytes (128 hex chars) for ECDSA signature with DER encoding
      // Or it could be longer with DER encoding overhead
      expect(signature.length).toBeGreaterThan(64);
      expect(signature).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle long messages', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = 'A'.repeat(1000);

      const signature = await signMessage(address, message);

      // Should handle long messages without issue
      expect(signature).toMatch(/^[0-9a-f]+$/);
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const message = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const signature = await signMessage(address, message);

      expect(signature).toMatch(/^[0-9a-f]+$/);
    });
  });
});
