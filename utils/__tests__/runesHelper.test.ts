/**
 * Tests for runesHelper.ts
 */

import { getRunesAmount } from '../runesHelper';

describe('runesHelper', () => {
  describe('getRunesAmount', () => {
    it('should return 0 for null input', () => {
      expect(getRunesAmount(null)).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      expect(getRunesAmount(undefined)).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(getRunesAmount([])).toBe(0);
    });

    describe('array format [rune, amount, symbol]', () => {
      it('should parse amount from array format', () => {
        const runesBalance = [['RUNE_NAME', '1000.5', 'RUNE']];
        expect(getRunesAmount(runesBalance)).toBe(1000.5);
      });

      it('should return 0 for invalid amount in array format', () => {
        const runesBalance = [['RUNE_NAME', 'invalid', 'RUNE']];
        expect(getRunesAmount(runesBalance)).toBe(0);
      });

      it('should handle integer amounts in array format', () => {
        const runesBalance = [['RUNE_NAME', '500', 'RUNE']];
        expect(getRunesAmount(runesBalance)).toBe(500);
      });
    });

    describe('object format { rune, amount, symbol }', () => {
      it('should parse amount from object format', () => {
        const runesBalance = [{ rune: 'RUNE_NAME', amount: '2500.75', symbol: 'RUNE' }];
        expect(getRunesAmount(runesBalance)).toBe(2500.75);
      });

      it('should return 0 for invalid amount in object format', () => {
        const runesBalance = [{ rune: 'RUNE_NAME', amount: 'not-a-number', symbol: 'RUNE' }];
        expect(getRunesAmount(runesBalance)).toBe(0);
      });

      it('should handle integer amounts in object format', () => {
        const runesBalance = [{ rune: 'RUNE_NAME', amount: '100', symbol: 'RUNE' }];
        expect(getRunesAmount(runesBalance)).toBe(100);
      });
    });

    describe('unknown format', () => {
      it('should return 0 for primitive values in array', () => {
        const runesBalance = ['some string'];
        expect(getRunesAmount(runesBalance)).toBe(0);
      });

      it('should return 0 for number in array', () => {
        const runesBalance = [12345];
        expect(getRunesAmount(runesBalance)).toBe(0);
      });

      it('should return 0 for object without amount property', () => {
        const runesBalance = [{ rune: 'RUNE_NAME', symbol: 'RUNE' }];
        expect(getRunesAmount(runesBalance)).toBe(0);
      });

      it('should return 0 for null first element', () => {
        const runesBalance = [null];
        expect(getRunesAmount(runesBalance as unknown[])).toBe(0);
      });

      it('should return 0 for boolean in array', () => {
        const runesBalance = [true];
        expect(getRunesAmount(runesBalance)).toBe(0);
      });
    });
  });
});
