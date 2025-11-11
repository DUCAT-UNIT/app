/**
 * AuthContext - Provides authentication state and methods to the entire app
 * Wraps the existing useAuth hook to make it available via Context API
 */

import React, { createContext, useContext } from 'react';
import { useAuth as useAuthHook } from '../hooks/useAuth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children, onSeedConfirmed }) => {
  const authState = useAuthHook({ onSeedConfirmed });

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
};
