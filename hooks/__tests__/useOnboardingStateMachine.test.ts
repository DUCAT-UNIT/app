/**
 * Tests for deriveOnboardingScreen pure function
 */

import {
  deriveOnboardingScreen,
  type OnboardingState,
} from '../useOnboardingStateMachine';

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    showPinInput: false,
    showRestorePinInput: false,
    settingUpPin: false,
    showPinEntry: false,
    isAuthenticated: false,
    wallet: null,
    seedConfirmed: false,
    importingWallet: false,
    restoringWithPasskey: false,
    ...overrides,
  };
}

describe('deriveOnboardingScreen', () => {
  it('returns passkey_pin_create when showPinInput is true', () => {
    expect(deriveOnboardingScreen(makeState({ showPinInput: true }))).toBe('passkey_pin_create');
  });

  it('returns passkey_pin_restore when showRestorePinInput is true', () => {
    expect(deriveOnboardingScreen(makeState({ showRestorePinInput: true }))).toBe(
      'passkey_pin_restore',
    );
  });

  it('returns pin_setup when settingUpPin is true', () => {
    expect(deriveOnboardingScreen(makeState({ settingUpPin: true }))).toBe('pin_setup');
  });

  it('returns locked when showPinEntry is true', () => {
    expect(deriveOnboardingScreen(makeState({ showPinEntry: true }))).toBe('locked');
  });

  it('returns locked when !authenticated + wallet + seedConfirmed', () => {
    expect(
      deriveOnboardingScreen(
        makeState({ isAuthenticated: false, wallet: { id: 1 }, seedConfirmed: true }),
      ),
    ).toBe('locked');
  });

  it('returns welcome when no wallet exists', () => {
    expect(deriveOnboardingScreen(makeState())).toBe('welcome');
  });

  it('returns welcome when wallet + authenticated + seedConfirmed (fallback)', () => {
    expect(
      deriveOnboardingScreen(
        makeState({ wallet: { id: 1 }, isAuthenticated: true, seedConfirmed: true }),
      ),
    ).toBe('welcome');
  });

  it('returns welcome when importing wallet', () => {
    expect(deriveOnboardingScreen(makeState({ importingWallet: true }))).toBe('welcome');
  });

  it('returns welcome when restoring with passkey', () => {
    expect(deriveOnboardingScreen(makeState({ restoringWithPasskey: true }))).toBe('welcome');
  });

  // Priority tests: when multiple flags are true, higher priority wins
  describe('priority order', () => {
    it('showPinInput takes priority over showRestorePinInput', () => {
      expect(
        deriveOnboardingScreen(makeState({ showPinInput: true, showRestorePinInput: true })),
      ).toBe('passkey_pin_create');
    });

    it('showPinInput takes priority over settingUpPin', () => {
      expect(
        deriveOnboardingScreen(makeState({ showPinInput: true, settingUpPin: true })),
      ).toBe('passkey_pin_create');
    });

    it('showPinInput takes priority over showPinEntry', () => {
      expect(
        deriveOnboardingScreen(makeState({ showPinInput: true, showPinEntry: true })),
      ).toBe('passkey_pin_create');
    });

    it('showRestorePinInput takes priority over settingUpPin', () => {
      expect(
        deriveOnboardingScreen(makeState({ showRestorePinInput: true, settingUpPin: true })),
      ).toBe('passkey_pin_restore');
    });

    it('showRestorePinInput takes priority over showPinEntry', () => {
      expect(
        deriveOnboardingScreen(makeState({ showRestorePinInput: true, showPinEntry: true })),
      ).toBe('passkey_pin_restore');
    });

    it('settingUpPin takes priority over showPinEntry', () => {
      expect(
        deriveOnboardingScreen(makeState({ settingUpPin: true, showPinEntry: true })),
      ).toBe('pin_setup');
    });

    it('showPinEntry takes priority over locked state (wallet + seedConfirmed)', () => {
      expect(
        deriveOnboardingScreen(
          makeState({
            showPinEntry: true,
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
          }),
        ),
      ).toBe('locked');
    });

    it('settingUpPin blocks the locked-wallet path', () => {
      expect(
        deriveOnboardingScreen(
          makeState({
            settingUpPin: true,
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
          }),
        ),
      ).toBe('pin_setup');
    });

    it('showPinInput takes priority over everything', () => {
      expect(
        deriveOnboardingScreen(
          makeState({
            showPinInput: true,
            showRestorePinInput: true,
            settingUpPin: true,
            showPinEntry: true,
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
          }),
        ),
      ).toBe('passkey_pin_create');
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('wallet exists but seedConfirmed is false returns welcome', () => {
      expect(
        deriveOnboardingScreen(
          makeState({ wallet: { id: 1 }, isAuthenticated: false, seedConfirmed: false }),
        ),
      ).toBe('welcome');
    });

    it('locked path requires settingUpPin to be false', () => {
      // settingUpPin=true means we go to pin_setup, NOT locked
      expect(
        deriveOnboardingScreen(
          makeState({
            wallet: { id: 1 },
            seedConfirmed: true,
            isAuthenticated: false,
            settingUpPin: true,
          }),
        ),
      ).toBe('pin_setup');
    });

    it('authenticated user with wallet but no seedConfirmed returns welcome', () => {
      expect(
        deriveOnboardingScreen(
          makeState({ wallet: { id: 1 }, isAuthenticated: true, seedConfirmed: false }),
        ),
      ).toBe('welcome');
    });
  });
});
