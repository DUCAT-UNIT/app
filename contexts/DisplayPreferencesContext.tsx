/**
 * DisplayPreferencesContext - MIGRATED TO ZUSTAND
 *
 * This file now provides backward compatibility by wrapping the Zustand store.
 * New code should import directly from stores/displayPreferencesStore.ts
 *
 * MIGRATION STATUS: Complete
 * - Provider is now a no-op (children pass-through)
 * - Hook returns Zustand store values with compatible interface
 */

import React, { ReactNode } from 'react';
import { useDisplayPreferencesStore } from '../stores/displayPreferencesStore';

interface DisplayPreferencesContextValue {
  showTotalInBTC: boolean;
  setShowTotalInBTC: React.Dispatch<React.SetStateAction<boolean>>;
  showBTCInBTC: boolean;
  setShowBTCInBTC: React.Dispatch<React.SetStateAction<boolean>>;
  showUnitInUnit: boolean;
  setShowUnitInUnit: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Hook that provides backward-compatible interface to Zustand store
 * Uses selective subscriptions for optimal performance
 */
export const useDisplayPreferences = (): DisplayPreferencesContextValue => {
  // Subscribe to individual state slices for optimal re-renders
  const showTotalInBTC = useDisplayPreferencesStore((state) => state.showTotalInBTC);
  const showBTCInBTC = useDisplayPreferencesStore((state) => state.showBTCInBTC);
  const showUnitInUnit = useDisplayPreferencesStore((state) => state.showUnitInUnit);
  const setShowTotalInBTCStore = useDisplayPreferencesStore((state) => state.setShowTotalInBTC);
  const setShowBTCInBTCStore = useDisplayPreferencesStore((state) => state.setShowBTCInBTC);
  const setShowUnitInUnitStore = useDisplayPreferencesStore((state) => state.setShowUnitInUnit);

  // Wrap setters to match React.Dispatch<SetStateAction<boolean>> signature
  const setShowTotalInBTC = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      // Need to get current value from store for updater function
      const currentValue = useDisplayPreferencesStore.getState().showTotalInBTC;
      setShowTotalInBTCStore(value(currentValue));
    } else {
      setShowTotalInBTCStore(value);
    }
  }, [setShowTotalInBTCStore]);

  const setShowBTCInBTC = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      const currentValue = useDisplayPreferencesStore.getState().showBTCInBTC;
      setShowBTCInBTCStore(value(currentValue));
    } else {
      setShowBTCInBTCStore(value);
    }
  }, [setShowBTCInBTCStore]);

  const setShowUnitInUnit = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      const currentValue = useDisplayPreferencesStore.getState().showUnitInUnit;
      setShowUnitInUnitStore(value(currentValue));
    } else {
      setShowUnitInUnitStore(value);
    }
  }, [setShowUnitInUnitStore]);

  // Memoize return object to prevent unnecessary re-renders in consumers
  return React.useMemo(() => ({
    showTotalInBTC,
    setShowTotalInBTC,
    showBTCInBTC,
    setShowBTCInBTC,
    showUnitInUnit,
    setShowUnitInUnit,
  }), [showTotalInBTC, setShowTotalInBTC, showBTCInBTC, setShowBTCInBTC, showUnitInUnit, setShowUnitInUnit]);
};

interface DisplayPreferencesProviderProps {
  children: ReactNode;
}

/**
 * Provider is now a pass-through - Zustand doesn't need providers!
 * Kept for backward compatibility with existing component tree
 */
export const DisplayPreferencesProvider: React.FC<DisplayPreferencesProviderProps> = ({ children }) => {
  // No provider needed - Zustand store is globally accessible
  return <>{children}</>;
};
