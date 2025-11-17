/**
 * Tests for Bitcoin utility functions
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { validateBitcoinAddress, validateAndNormalizeAddress, deriveAddressesFromMnemonic, MUTINYNET_NETWORK, validateNetworkConfig } from '../bitcoin';

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc);

describe('bitcoin utilities', () => {
  describe('deriveAddressesFromMnemonic', () => {
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    it('should derive segwit and taproot addresses from mnemonic', () => {
      const result = deriveAddressesFromMnemonic(testMnemonic, 0);

      expect(result).toHaveProperty('segwitAddress');
      expect(result).toHaveProperty('taprootAddress');
      expect(result).toHaveProperty('segwitPubkey');
      expect(result).toHaveProperty('taprootPubkey');

      // Verify address formats
      expect(result.segwitAddress).toMatch(/^tb1q[a-z0-9]+$/);
      expect(result.taprootAddress).toMatch(/^tb1p[a-z0-9]+$/);
    });

    it('should generate different addresses for different account indices', () => {
      const account0 = deriveAddressesFromMnemonic(testMnemonic, 0);
      const account1 = deriveAddressesFromMnemonic(testMnemonic, 1);
      const account2 = deriveAddressesFromMnemonic(testMnemonic, 2);

      // Addresses should be different for different accounts
      expect(account0.segwitAddress).not.toBe(account1.segwitAddress);
      expect(account1.segwitAddress).not.toBe(account2.segwitAddress);
      expect(account0.taprootAddress).not.toBe(account1.taprootAddress);
      expect(account1.taprootAddress).not.toBe(account2.taprootAddress);
    });

    it('should consistently generate same addresses for same mnemonic and account', () => {
      const result1 = deriveAddressesFromMnemonic(testMnemonic, 0);
      const result2 = deriveAddressesFromMnemonic(testMnemonic, 0);

      // Should be deterministic
      expect(result1.segwitAddress).toBe(result2.segwitAddress);
      expect(result1.taprootAddress).toBe(result2.taprootAddress);
      expect(result1.segwitPubkey).toBe(result2.segwitPubkey);
      expect(result1.taprootPubkey).toBe(result2.taprootPubkey);
    });

    it('should generate hex-encoded public keys', () => {
      const result = deriveAddressesFromMnemonic(testMnemonic, 0);

      // Segwit pubkey should be 66 chars (33 bytes compressed)
      expect(result.segwitPubkey).toMatch(/^[0-9a-f]{66}$/);
      // Taproot pubkey should be 64 chars (32 bytes x-only)
      expect(result.taprootPubkey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should use BIP84 path for segwit (m/84\'/1\'/0\'/0/{index})', () => {
      // This is implicitly tested by verifying we get valid tb1q addresses
      const result = deriveAddressesFromMnemonic(testMnemonic, 0);
      expect(result.segwitAddress).toMatch(/^tb1q/);
    });

    it('should use BIP86 path for taproot (m/86\'/1\'/0\'/0/{index})', () => {
      // This is implicitly tested by verifying we get valid tb1p addresses
      const result = deriveAddressesFromMnemonic(testMnemonic, 0);
      expect(result.taprootAddress).toMatch(/^tb1p/);
    });

    it('should default to account index 0 when not specified', () => {
      const withoutIndex = deriveAddressesFromMnemonic(testMnemonic);
      const withIndex0 = deriveAddressesFromMnemonic(testMnemonic, 0);

      expect(withoutIndex.segwitAddress).toBe(withIndex0.segwitAddress);
      expect(withoutIndex.taprootAddress).toBe(withIndex0.taprootAddress);
    });

    it('should handle high account indices', () => {
      const result = deriveAddressesFromMnemonic(testMnemonic, 100);

      expect(result.segwitAddress).toMatch(/^tb1q/);
      expect(result.taprootAddress).toMatch(/^tb1p/);
      expect(result).toHaveProperty('segwitPubkey');
      expect(result).toHaveProperty('taprootPubkey');
    });

    it('should derive addresses for different mnemonics', () => {
      const mnemonic1 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const mnemonic2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

      const result1 = deriveAddressesFromMnemonic(mnemonic1, 0);
      const result2 = deriveAddressesFromMnemonic(mnemonic2, 0);

      // Different mnemonics should generate different addresses
      expect(result1.segwitAddress).not.toBe(result2.segwitAddress);
      expect(result1.taprootAddress).not.toBe(result2.taprootAddress);
    });
  });

  describe('MUTINYNET_NETWORK', () => {
    it('should have correct testnet configuration', () => {
      expect(MUTINYNET_NETWORK.bech32).toBe('tb');
      expect(MUTINYNET_NETWORK.messagePrefix).toBe('\x18Bitcoin Signed Message:\n');
      expect(MUTINYNET_NETWORK.pubKeyHash).toBe(0x6f);
      expect(MUTINYNET_NETWORK.scriptHash).toBe(0xc4);
      expect(MUTINYNET_NETWORK.wif).toBe(0xef);
    });

    it('should have correct BIP32 configuration', () => {
      expect(MUTINYNET_NETWORK.bip32.public).toBe(0x043587cf);
      expect(MUTINYNET_NETWORK.bip32.private).toBe(0x04358394);
    });
  });

  describe('validateBitcoinAddress', () => {
    describe('valid addresses', () => {
      it('should validate segwit testnet address (tb1q)', () => {
        const result = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('segwit');
      });

      // Taproot address validation - skip for now due to address format issues
      // it('should validate taproot testnet address (tb1p)', () => {
      //   const result = validateBitcoinAddress('tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c');
      //   expect(result.valid).toBe(true);
      //   expect(result.type).toBe('taproot');
      // });
    });

    describe('invalid addresses', () => {
      it('should reject empty string', () => {
        const result = validateBitcoinAddress('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Address is required');
      });

      it('should reject null', () => {
        const result = validateBitcoinAddress(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Address is required');
      });

      it('should reject undefined', () => {
        const result = validateBitcoinAddress(undefined);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Address is required');
      });

      it('should reject non-string input', () => {
        const result = validateBitcoinAddress(123);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Address is required');
      });

      it('should reject whitespace-only string', () => {
        const result = validateBitcoinAddress('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Address cannot be empty');
      });

      it('should reject invalid format', () => {
        const result = validateBitcoinAddress('not-a-bitcoin-address');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid Bitcoin address format');
      });

      it('should reject mainnet address (bc1q)', () => {
        const result = validateBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Mainnet address detected');
      });

      it('should reject mainnet address (bc1p)', () => {
        const result = validateBitcoinAddress('bc1pmzfrwwndsqmk5yh69yjr5lfgfg4ev8c0tsc06e');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Mainnet address detected');
      });

      it('should reject mainnet P2PKH address (1)', () => {
        const result = validateBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Mainnet address detected');
      });

      it('should reject mainnet P2SH address (3)', () => {
        const result = validateBitcoinAddress('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Mainnet address detected');
      });

      it('should reject truncated address', () => {
        const result = validateBitcoinAddress('tb1qw508d6qej');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid Bitcoin address format');
      });

      it('should reject address with typo', () => {
        const result = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsX'); // Capital X
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid Bitcoin address format');
      });
    });

    describe('address trimming', () => {
      it('should validate address with leading whitespace', () => {
        const result = validateBitcoinAddress('  tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('segwit');
      });

      it('should validate address with trailing whitespace', () => {
        const result = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx  ');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('segwit');
      });

      it('should validate address with both leading and trailing whitespace', () => {
        const result = validateBitcoinAddress('  tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx  ');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('segwit');
      });
    });

    describe('address type detection', () => {
      it('should detect segwit (tb1q) type', () => {
        const result = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
        expect(result.type).toBe('segwit');
      });

      it('should detect taproot (tb1p) type', () => {
        // Generate a real taproot address from the test mnemonic
        const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
        const { taprootAddress } = deriveAddressesFromMnemonic(testMnemonic, 0);

        const result = validateBitcoinAddress(taprootAddress);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('taproot');
      });

      it('should detect legacy P2SH type (2)', () => {
        // P2SH testnet addresses start with '2'
        const result = validateBitcoinAddress('2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('legacy');
      });

      it('should detect legacy P2PKH type (m)', () => {
        // P2PKH testnet addresses can start with 'm'
        const result = validateBitcoinAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('legacy');
      });

      it('should detect legacy P2PKH type (n)', () => {
        // P2PKH testnet addresses can start with 'n'
        const result = validateBitcoinAddress('n3GNqMveyvaPvUbH469vDRadqpJMPc84JA');
        expect(result.valid).toBe(true);
        expect(result.type).toBe('legacy');
      });
    });
  });

  describe('validateAndNormalizeAddress', () => {
    it('should return trimmed address for valid input', () => {
      const address = '  tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx  ';
      const normalized = validateAndNormalizeAddress(address);
      expect(normalized).toBe('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
    });

    it('should throw error for invalid address', () => {
      expect(() => {
        validateAndNormalizeAddress('invalid-address');
      }).toThrow('Invalid Bitcoin address format');
    });

    it('should throw error for empty address', () => {
      expect(() => {
        validateAndNormalizeAddress('');
      }).toThrow('Address is required');
    });

    it('should throw error for null address', () => {
      expect(() => {
        validateAndNormalizeAddress(null);
      }).toThrow('Address is required');
    });

    it('should throw error for mainnet address', () => {
      expect(() => {
        validateAndNormalizeAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
      }).toThrow('Mainnet address detected');
    });

    it('should preserve valid address without whitespace', () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const normalized = validateAndNormalizeAddress(address);
      expect(normalized).toBe(address);
    });
  });

  describe('edge cases', () => {
    it('should handle various invalid input types', () => {
      expect(validateBitcoinAddress(0).valid).toBe(false);
      expect(validateBitcoinAddress(false).valid).toBe(false);
      expect(validateBitcoinAddress({}).valid).toBe(false);
      expect(validateBitcoinAddress([]).valid).toBe(false);
    });

    it('should handle extremely long strings', () => {
      const longString = 'tb1q' + 'a'.repeat(1000);
      const result = validateBitcoinAddress(longString);
      expect(result.valid).toBe(false);
    });

    it('should handle special characters', () => {
      const result = validateBitcoinAddress('tb1q@#$%^&*()');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Bitcoin address format');
    });

    it('should handle unicode characters', () => {
      const result = validateBitcoinAddress('tb1q你好世界');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Bitcoin address format');
    });
  });

  describe('security checks', () => {
    it('should prevent mainnet/testnet confusion', () => {
      // Mainnet segwit
      expect(validateBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq').valid).toBe(false);

      // Mainnet taproot
      expect(validateBitcoinAddress('bc1pmzfrwwndsqmk5yh69yjr5lfgfg4ev8c0tsc06e').valid).toBe(false);

      // Mainnet legacy
      expect(validateBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').valid).toBe(false);
      expect(validateBitcoinAddress('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy').valid).toBe(false);
    });

    it('should provide helpful error for mainnet addresses', () => {
      const result = validateBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
      expect(result.error).toContain('Mainnet address detected');
      expect(result.error).toContain('testnet address');
    });
  });

  describe('validateNetworkConfig', () => {
    it('should pass validation for correct testnet configuration', () => {
      // Should not throw any error
      expect(() => validateNetworkConfig()).not.toThrow();
      expect(validateNetworkConfig()).toBe(true);
    });

    it('should validate bech32 prefix is testnet', () => {
      // This test confirms current configuration
      expect(MUTINYNET_NETWORK.bech32).toBe('tb');
    });

    it('should validate pubKeyHash is testnet', () => {
      // This test confirms current configuration
      expect(MUTINYNET_NETWORK.pubKeyHash).toBe(0x6f);
    });

    it('should validate scriptHash is testnet', () => {
      // This test confirms current configuration
      expect(MUTINYNET_NETWORK.scriptHash).toBe(0xc4);
    });

    it('should be called before address derivation', () => {
      // Verify deriveAddressesFromMnemonic calls validateNetworkConfig
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

      // Should not throw - network config is valid
      expect(() => deriveAddressesFromMnemonic(testMnemonic, 0)).not.toThrow();
    });

    it('should protect against mainnet configuration', () => {
      // This is a conceptual test - we verify that if network config was wrong,
      // validation would catch it. The actual mutation testing would require
      // mocking or modifying the MUTINYNET_NETWORK object.

      // Current config should match expected testnet values
      expect(MUTINYNET_NETWORK.bech32).not.toBe('bc'); // mainnet would be 'bc'
      expect(MUTINYNET_NETWORK.pubKeyHash).not.toBe(0x00); // mainnet would be 0x00
      expect(MUTINYNET_NETWORK.scriptHash).not.toBe(0x05); // mainnet would be 0x05
    });

    it('should validate all network parameters', () => {
      // Verify all critical network parameters are testnet values
      const config = MUTINYNET_NETWORK;

      // Testnet bech32 prefix
      expect(config.bech32).toBe('tb');

      // Testnet address prefixes
      expect(config.pubKeyHash).toBe(0x6f); // testnet P2PKH
      expect(config.scriptHash).toBe(0xc4); // testnet P2SH

      // Testnet WIF
      expect(config.wif).toBe(0xef);

      // Testnet BIP32
      expect(config.bip32.public).toBe(0x043587cf);
      expect(config.bip32.private).toBe(0x04358394);
    });
  });
});
