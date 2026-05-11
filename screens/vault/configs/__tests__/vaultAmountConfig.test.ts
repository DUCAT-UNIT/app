import { borrowInputConfig } from '../borrowConfig';
import { repayInputConfig } from '../repayConfig';
import type { VaultPreview } from '../../types';

const healthyPreview: VaultPreview = {
  newCollateral: 1,
  newDebt: 1,
  newHealth: 200,
  newLiqPrice: 100,
};

describe('vault USD amount validation', () => {
  it('blocks sub-cent borrow amounts that display as $0.00', () => {
    const result = borrowInputConfig.validate(0.001, 100, 1, 0, healthyPreview, true);

    expect(result.canContinue).toBe(false);
    expect(result.errors).toContain('Enter at least $0.01 to borrow.');
  });

  it('allows borrow amounts at the minimum cent value', () => {
    const result = borrowInputConfig.validate(0.01, 100, 1, 0, healthyPreview, true);

    expect(result.canContinue).toBe(true);
  });

  it('blocks sub-cent repay amounts that display as $0.00', () => {
    const result = repayInputConfig.validate(0.001, 100, 1, 100, healthyPreview, true, {
      repayBalanceUsd: 100,
      directUnitBalanceUsd: 100,
      turboUnitBalanceUsd: 0,
      allowUsdc: true,
      allowTurboUnit: true,
    });

    expect(result.canContinue).toBe(false);
    expect(result.errors).toContain('Enter at least $0.01 to repay.');
  });
});
