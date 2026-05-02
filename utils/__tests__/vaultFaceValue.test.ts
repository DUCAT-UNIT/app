import {
  formatVaultUsd,
  formatVaultUsdFromSmallestUnits,
  protocolUnitToUsd,
  smallestUnitAmountToUsd,
  usdToProtocolUnitAmount,
} from '../vaultFaceValue';

describe('vaultFaceValue', () => {
  it('rounds USD and protocol UNIT values to cents', () => {
    expect(usdToProtocolUnitAmount(123.456)).toBe(123.46);
    expect(protocolUnitToUsd(123.454)).toBe(123.45);
  });

  it('treats null, undefined, NaN, and infinity as zero', () => {
    expect(usdToProtocolUnitAmount(null)).toBe(0);
    expect(protocolUnitToUsd(undefined)).toBe(0);
    expect(smallestUnitAmountToUsd(Number.NaN)).toBe(0);
    expect(smallestUnitAmountToUsd(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('converts smallest UNIT amounts into face-value USD', () => {
    expect(smallestUnitAmountToUsd(12_345)).toBe(123.45);
    expect(smallestUnitAmountToUsd(12_346n)).toBe(123.46);
    expect(smallestUnitAmountToUsd(null)).toBe(0);
    expect(smallestUnitAmountToUsd(undefined)).toBe(0);
  });

  it('formats vault USD from face values and smallest units', () => {
    expect(formatVaultUsd(1234.5)).toBe('$1,234.50');
    expect(formatVaultUsd(1234.567, 0)).toBe('$1,235');
    expect(formatVaultUsdFromSmallestUnits(123_456)).toBe('$1,234.56');
    expect(formatVaultUsdFromSmallestUnits(123_456n, 1)).toBe('$1,234.6');
  });
});
