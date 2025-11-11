/**
 * ToastContext - Global toast notification state
 * Provides showToast and toasts across the entire app
 * Eliminates need for multiple useToast() instances
 */

import React, { createContext, useContext, useState, useRef } from 'react';

const ToastContext = createContext();

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

let nextId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  const showToast = (message, type = 'success') => {
    // Clear all existing timeouts
    Object.keys(timeoutsRef.current).forEach((key) => {
      clearTimeout(timeoutsRef.current[key]);
      delete timeoutsRef.current[key];
    });

    const id = nextId++;
    const duration = type === 'error' ? 3500 : 2000;

    // Replace all toasts with just this new one
    const newToast = { id, message, type };
    setToasts([newToast]);

    // Auto-hide after duration
    timeoutsRef.current[id] = setTimeout(() => {
      setToasts([]);
      delete timeoutsRef.current[id];
    }, duration);
  };

  const dismissToast = (id) => {
    // Clear timeout
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }

    // Remove toast
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const value = {
    showToast,
    toasts,
    dismissToast,
    // Legacy props for backwards compatibility
    toastMessage: toasts[0]?.message || '',
    toastVisible: toasts.length > 0,
    toastType: toasts[0]?.type || 'success',
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
