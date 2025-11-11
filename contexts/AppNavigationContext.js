/**
 * AppNavigationContext
 * Manages app-level navigation state: active tab, inactivity timer
 */

import React, { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';

const AppNavigationContext = createContext();

export const AppNavigationProvider = ({ children, _inactivityTimeout = 300000 }) => {
  const [activeTab, setActiveTab] = useState('wallet');
  const inactivityTimerRef = useRef(null);

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Timer logic would be set by parent if needed
  };

  const value = {
    activeTab,
    setActiveTab,
    resetInactivityTimer,
    inactivityTimerRef,
  };

  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>;
};

AppNavigationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  _inactivityTimeout: PropTypes.number,
};

export const useAppNavigation = () => {
  const context = useContext(AppNavigationContext);
  if (!context) {
    throw new Error('useAppNavigation must be used within AppNavigationProvider');
  }
  return context;
};
