/**
 * Tests for displayPreferencesStore
 * Consolidated to test meaningful behavior, not trivial setters
 */

import { act } from '@testing-library/react-native';
import {
  useDisplayPreferencesStore,
  resetDisplayPreferencesStore,
} from '../displayPreferencesStore';

describe('displayPreferencesStore', () => {
  beforeEach(() => {
    resetDisplayPreferencesStore();
  });

  it('should have correct initial state', () => {
    const state = useDisplayPreferencesStore.getState();
    expect(state).toMatchObject({
      showTotalInBTC: false,
      showBTCInBTC: false,
      showUnitInUnit: false,
    });
  });

  describe('individual preference toggles', () => {
    it('should set and toggle showTotalInBTC', () => {
      const { setShowTotalInBTC, toggleShowTotalInBTC } = useDisplayPreferencesStore.getState();

      act(() => setShowTotalInBTC(true));
      expect(useDisplayPreferencesStore.getState().showTotalInBTC).toBe(true);

      act(() => toggleShowTotalInBTC());
      expect(useDisplayPreferencesStore.getState().showTotalInBTC).toBe(false);
    });

    it('should set and toggle showBTCInBTC', () => {
      const { setShowBTCInBTC, toggleShowBTCInBTC } = useDisplayPreferencesStore.getState();

      act(() => setShowBTCInBTC(true));
      expect(useDisplayPreferencesStore.getState().showBTCInBTC).toBe(true);

      act(() => toggleShowBTCInBTC());
      expect(useDisplayPreferencesStore.getState().showBTCInBTC).toBe(false);
    });

    it('should set and toggle showUnitInUnit', () => {
      const { setShowUnitInUnit, toggleShowUnitInUnit } = useDisplayPreferencesStore.getState();

      act(() => setShowUnitInUnit(true));
      expect(useDisplayPreferencesStore.getState().showUnitInUnit).toBe(true);

      act(() => toggleShowUnitInUnit());
      expect(useDisplayPreferencesStore.getState().showUnitInUnit).toBe(false);
    });
  });

  it('should toggle each preference independently without affecting others', () => {
    const { toggleShowTotalInBTC, toggleShowBTCInBTC } = useDisplayPreferencesStore.getState();

    act(() => {
      toggleShowTotalInBTC();
    });

    const state = useDisplayPreferencesStore.getState();
    expect(state.showTotalInBTC).toBe(true);
    expect(state.showBTCInBTC).toBe(false);
    expect(state.showUnitInUnit).toBe(false);
  });

  it('should reset all values to initial state', () => {
    const { setShowTotalInBTC, setShowBTCInBTC, setShowUnitInUnit } =
      useDisplayPreferencesStore.getState();

    act(() => {
      setShowTotalInBTC(true);
      setShowBTCInBTC(true);
      setShowUnitInUnit(true);
    });

    act(() => {
      resetDisplayPreferencesStore();
    });

    const state = useDisplayPreferencesStore.getState();
    expect(state.showTotalInBTC).toBe(false);
    expect(state.showBTCInBTC).toBe(false);
    expect(state.showUnitInUnit).toBe(false);
  });
});
