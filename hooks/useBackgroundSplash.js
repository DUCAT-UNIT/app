/**
 * useBackgroundSplash - Shows splash screen when app is backgrounded
 * Protects sensitive information in app switcher preview
 */

import { useState, useEffect } from 'react';
import { AppState } from 'react-native';

export const useBackgroundSplash = () => {
  const [showBackgroundSplash, setShowBackgroundSplash] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setShowBackgroundSplash(true);
      } else if (nextAppState === 'active') {
        setShowBackgroundSplash(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return { showBackgroundSplash };
};
