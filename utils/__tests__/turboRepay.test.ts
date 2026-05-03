import { getRepayableTurboUnitContribution } from '../turboRepay';

describe('turboRepay', () => {
  it('uses the full TurboUNIT balance for UNIT repay capacity by default', () => {
    expect(getRepayableTurboUnitContribution(2731)).toBe(27.31);
  });

  it('can reserve an explicitly quoted fee when one is provided', () => {
    expect(getRepayableTurboUnitContribution(2731, 1000)).toBe(17.31);
  });

  it('returns zero when the TurboUNIT balance only covers an explicit fee', () => {
    expect(getRepayableTurboUnitContribution(1000, 1000)).toBe(0);
  });
});
