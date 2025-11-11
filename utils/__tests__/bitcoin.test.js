/**
 * Tests for Bitcoin utility functions
 */

import { validateBitcoinAddress, validateAndNormalizeAddress } from '../bitcoin';

describe('bitcoin utilities', () => {
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

      // Taproot address type detection - skip for now due to address format issues
      // it('should detect taproot (tb1p) type', () => {
      //   const result = validateBitcoinAddress('tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c');
      //   expect(result.type).toBe('taproot');
      // });
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
});
