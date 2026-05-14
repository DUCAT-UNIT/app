import { roundNumber, roundNumberDown, satsToBtc } from '../math';

describe('liquidation math helpers', () => {
  it('rounds to the requested precision', () => {
    expect(roundNumber(1.234, 2)).toBe(1.23);
    expect(roundNumber(1.235, 2)).toBe(1.24);
  });

  it('rounds down without crossing the requested precision', () => {
    expect(roundNumberDown(1.239, 2)).toBe(1.23);
    expect(roundNumberDown(0.000000019, 8)).toBe(0.00000001);
  });

  it('converts sats to BTC', () => {
    expect(satsToBtc(100_000_000)).toBe(1);
    expect(satsToBtc(12_345)).toBe(0.00012345);
  });
});
