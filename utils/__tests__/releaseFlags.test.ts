import { resolveEnableLiquidations } from '../releaseFlags';

describe('releaseFlags', () => {
  const originalEnableLiquidations = process.env.EXPO_PUBLIC_ENABLE_LIQUIDATIONS;

  afterEach(() => {
    jest.resetModules();
    if (originalEnableLiquidations === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_LIQUIDATIONS;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_LIQUIDATIONS = originalEnableLiquidations;
    }
  });

  function loadReleaseFlags(value?: string): typeof import('../releaseFlags') {
    jest.resetModules();
    if (value === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_LIQUIDATIONS;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_LIQUIDATIONS = value;
    }

    return require('../releaseFlags');
  }

  it('keeps liquidations disabled for this release', () => {
    expect(loadReleaseFlags().ENABLE_LIQUIDATIONS).toBe(false);
    expect(loadReleaseFlags('false').ENABLE_LIQUIDATIONS).toBe(false);
    expect(loadReleaseFlags('1').ENABLE_LIQUIDATIONS).toBe(false);
    expect(loadReleaseFlags('true').ENABLE_LIQUIDATIONS).toBe(false);
    expect(
      resolveEnableLiquidations({
        explicitFlag: 'true',
        isDev: true,
        isTest: true,
      })
    ).toBe(false);
  });

  it('keeps production release liquidations disabled even when the env flag is true', () => {
    expect(
      resolveEnableLiquidations({
        explicitFlag: 'true',
        isDev: false,
        isTest: false,
      })
    ).toBe(false);
  });

  it('uses one hard unavailable message for disabled liquidations', () => {
    expect(loadReleaseFlags().LIQUIDATIONS_UNAVAILABLE_MESSAGE).toBe(
      'Liquidations are not available.'
    );
  });
});
