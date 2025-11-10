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
      // Only show splash when truly backgrounded, not during inactive state
      // (inactive happens during Face ID, notifications, control center, etc.)
      if (nextAppState === 'background') {
        setShowBackgroundSplash(true);
      } else if (nextAppState === 'active' || nextAppState === 'inactive') {
        // CRITICAL FIX: Clear splash on both 'active' AND 'inactive' states
        // iOS can transition: background → inactive → active
        // If we only clear on 'active', the splash can get stuck during 'inactive'
        setShowBackgroundSplash(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return { showBackgroundSplash };
};
