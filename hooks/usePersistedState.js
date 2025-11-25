/**
 * usePersistedState Hook
 * React hook for state that persists to AsyncStorage
 * Automatically loads on mount and saves on every change
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

/**
 * Hook that persists state to AsyncStorage
 * @param {string} key - AsyncStorage key
 * @param {any} initialState - Initial state value (used if no persisted value found)
 * @param {Object} options - Configuration options
 * @param {Function} options.serializer - Custom serializer (default: JSON.stringify)
 * @param {Function} options.deserializer - Custom deserializer (default: JSON.parse)
 * @param {Function} options.onLoad - Callback when state loads (state) => void
 * @param {Function} options.onSave - Callback when state saves (state) => void
 * @param {Function} options.onError - Callback when error occurs (error, operation) => void
 * @param {boolean} options.silent - Suppress error logging (default: false)
 * @returns {[any, Function, Function, boolean]} [state, setState, clearState, isLoaded]
 */
export function usePersistedState(key, initialState, options = {}) {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    onLoad,
    onSave,
    onError,
    silent = false,
  } = options;

  const [state, setStateInternal] = useState(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Load persisted state on mount
  useEffect(() => {
    isMountedRef.current = true;

    const loadState = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      try {
        const savedValue = await AsyncStorage.getItem(key);

        if (savedValue !== null && isMountedRef.current) {
          const deserialized = deserializer(savedValue);
          // Merge with initial state to fill in missing fields with defaults
          // Only override default values with non-null/undefined values from persisted state
          let mergedState = deserialized;
          if (typeof initialState === 'object' && !Array.isArray(initialState) && typeof deserialized === 'object' && !Array.isArray(deserialized)) {
            mergedState = { ...initialState };
            for (const propKey in deserialized) {
              if (deserialized[propKey] !== null && deserialized[propKey] !== undefined) {
                mergedState[propKey] = deserialized[propKey];
              }
            }
          }
          setStateInternal(mergedState);

          if (onLoad) {
            onLoad(mergedState);
          }
        }
      } catch (error) {
        if (!silent) {
          logger.error(`usePersistedState: Error loading state for key "${key}":`, error);
        }

        if (onError) {
          onError(error, 'load');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoaded(true);
          isLoadingRef.current = false;
        }
      }
    };

    loadState();

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only run on mount and key change - intentionally omitting deserializer, initialState, onError, onLoad, silent

  // Save state whenever it changes (after initial load)
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load completes

    const saveState = async () => {
      try {
        const serialized = serializer(state);
        await AsyncStorage.setItem(key, serialized);

        if (onSave) {
          onSave(state);
        }
      } catch (error) {
        if (!silent) {
          logger.error(`usePersistedState: Error saving state for key "${key}":`, error);
        }

        if (onError) {
          onError(error, 'save');
        }
      }
    };

    saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isLoaded, key]); // Save when state changes - intentionally omitting onError, onSave, serializer, silent

  /**
   * Clear persisted state from AsyncStorage and reset to initial
   */
  const clearState = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(key);
      setStateInternal(initialState);

      if (onSave) {
        onSave(initialState);
      }
    } catch (error) {
      if (!silent) {
        logger.error(`usePersistedState: Error clearing state for key "${key}":`, error);
      }

      if (onError) {
        onError(error, 'clear');
      }
    }
  }, [key, initialState, onSave, onError, silent]);

  return [state, setStateInternal, clearState, isLoaded];
}

/**
 * Hook for persisting multiple related state values as an object
 * @param {string} key - AsyncStorage key
 * @param {Object} initialState - Initial state object
 * @param {Object} options - Same options as usePersistedState
 * @returns {[Object, Function, Function, boolean]} [state, updateState, clearState, isLoaded]
 */
export function usePersistedObject(key, initialState = {}, options = {}) {
  const [state, setState, clearState, isLoaded] = usePersistedState(key, initialState, options);

  /**
   * Update specific fields in the state object
   * Similar to setState in class components - merges partial updates
   */
  const updateState = useCallback(
    (updates) => {
      if (typeof updates === 'function') {
        // Support functional updates: updateState(prev => ({ ...prev, field: value }))
        setState((prev) => updates(prev));
      } else {
        // Support object merge: updateState({ field: value })
        setState((prev) => ({ ...prev, ...updates }));
      }
    },
    [setState]
  );

  return [state, updateState, clearState, isLoaded];
}

/**
 * Hook for persisting an array with helper methods
 * @param {string} key - AsyncStorage key
 * @param {Array} initialState - Initial array
 * @param {Object} options - Same options as usePersistedState
 * @returns {[Array, Object, Function, boolean]} [items, helpers, clearState, isLoaded]
 */
export function usePersistedArray(key, initialState = [], options = {}) {
  const [items, setItems, clearState, isLoaded] = usePersistedState(key, initialState, options);

  const helpers = {
    push: useCallback(
      (item) => {
        setItems((prev) => [...prev, item]);
      },
      [setItems]
    ),

    remove: useCallback(
      (predicate) => {
        setItems((prev) => prev.filter((item) => !predicate(item)));
      },
      [setItems]
    ),

    update: useCallback(
      (predicate, updates) => {
        setItems((prev) =>
          prev.map((item) => (predicate(item) ? { ...item, ...updates } : item))
        );
      },
      [setItems]
    ),

    replace: useCallback(
      (newItems) => {
        setItems(newItems);
      },
      [setItems]
    ),
  };

  return [items, helpers, clearState, isLoaded];
}
