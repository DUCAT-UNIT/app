/**
 * DisplayPreferencesContext - User display preferences
 * Manages how balances and amounts are displayed (BTC vs USD)
 * Separated from UIContext for better performance and organization
 */

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface DisplayPreferencesContextValue {
  showTotalInBTC: boolean;
  setShowTotalInBTC: React.Dispatch<React.SetStateAction<boolean>>;
  showBTCInBTC: boolean;
  setShowBTCInBTC: React.Dispatch<React.SetStateAction<boolean>>;
  showUnitInUnit: boolean;
  setShowUnitInUnit: React.Dispatch<React.SetStateAction<boolean>>;
}

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | undefined>(undefined);

export const useDisplayPreferences = (): DisplayPreferencesContextValue => {
  const context = useContext(DisplayPreferencesContext);
  if (!context) {
    throw new Error('useDisplayPreferences must be used within a DisplayPreferencesProvider');
  }
  return context;
};

interface DisplayPreferencesProviderProps {
  children: ReactNode;
}

export const DisplayPreferencesProvider: React.FC<DisplayPreferencesProviderProps> = ({ children }) => {
  // Display preferences state
  const [showTotalInBTC, setShowTotalInBTC] = useState(false);
  const [showBTCInBTC, setShowBTCInBTC] = useState(false);
  const [showUnitInUnit, setShowUnitInUnit] = useState(false);

  // Memoize value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      showTotalInBTC,
      setShowTotalInBTC,
      showBTCInBTC,
      setShowBTCInBTC,
      showUnitInUnit,
      setShowUnitInUnit,
    }),
    [showTotalInBTC, showBTCInBTC, showUnitInUnit]
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
};
