// @ts-nocheck
/**
 * Tests for usePersistedState Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistedState, usePersistedObject, usePersistedArray } from '../usePersistedState';

// Helper to render hooks
function renderHook(hook) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component.unmount(),
  };
}

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('usePersistedState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
    AsyncStorage.removeItem.mockResolvedValue(null);
  });

  it('should initialize with initial state', () => {
    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    const [state, , , isLoaded] = result.current;
    expect(state).toBe('initial');
    expect(isLoaded).toBe(false);
  });

  it('should load persisted state from AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify('persisted-value'));

    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const [state, , , isLoaded] = result.current;
    expect(state).toBe('persisted-value');
    expect(isLoaded).toBe(true);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  it('should save state to AsyncStorage on change', async () => {
    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Change state
    act(() => {
      const [, setState] = result.current;
      setState('new-value');
    });

    // Wait for save
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
  });

  it('should clear state from AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify('persisted'));

    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Clear state
    await act(async () => {
      const [, , clearState] = result.current;
      await clearState();
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
    const [state] = result.current;
    expect(state).toBe('initial');
  });

  it('should handle load errors gracefully', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('Load error'));

    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const [state, , , isLoaded] = result.current;
    expect(state).toBe('initial');
    expect(isLoaded).toBe(true);
  });

  it('should handle save errors gracefully', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('Save error'));

    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should not throw
    act(() => {
      const [, setState] = result.current;
      setState('new-value');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const [state] = result.current;
    expect(state).toBe('new-value');
  });

  it('should use custom serializer and deserializer', async () => {
    const customSerializer = (value) => `custom:${value}`;
    const customDeserializer = (value) => value.replace('custom:', '');

    AsyncStorage.getItem.mockResolvedValue('custom:loaded');

    const { result } = renderHook(() =>
      usePersistedState('test-key', 'initial', {
        serializer: customSerializer,
        deserializer: customDeserializer,
      })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const [state] = result.current;
    expect(state).toBe('loaded');

    act(() => {
      const [, setState] = result.current;
      setState('saved');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('test-key', 'custom:saved');
  });

  it('should call onLoad callback', async () => {
    const onLoad = jest.fn();
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify('loaded'));

    renderHook(() => usePersistedState('test-key', 'initial', { onLoad }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onLoad).toHaveBeenCalledWith('loaded');
  });

  it('should call onSave callback', async () => {
    const onSave = jest.fn();

    const { result } = renderHook(() => usePersistedState('test-key', 'initial', { onSave }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, setState] = result.current;
      setState('new');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSave).toHaveBeenCalledWith('new');
  });

  it('should call onError callback on load error', async () => {
    const onError = jest.fn();
    const error = new Error('Load failed');
    AsyncStorage.getItem.mockRejectedValue(error);

    renderHook(() => usePersistedState('test-key', 'initial', { onError }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onError).toHaveBeenCalledWith(error, 'load');
  });

  it('should call onError callback on save error', async () => {
    const onError = jest.fn();
    const error = new Error('Save failed');
    AsyncStorage.setItem.mockRejectedValue(error);

    const { result } = renderHook(() => usePersistedState('test-key', 'initial', { onError }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, setState] = result.current;
      setState('new');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onError).toHaveBeenCalledWith(error, 'save');
  });

  it('should call onError callback on clear error', async () => {
    const onError = jest.fn();
    const error = new Error('Clear failed');
    AsyncStorage.removeItem.mockRejectedValue(error);

    const { result } = renderHook(() => usePersistedState('test-key', 'initial', { onError }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      const [, , clearState] = result.current;
      await clearState();
    });

    expect(onError).toHaveBeenCalledWith(error, 'clear');
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => usePersistedState('test-key', 'initial'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Unmount
    act(() => {
      unmount();
    });

    // Should not crash
    expect(result.current).toBeTruthy();
  });
});

describe('usePersistedObject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
  });

  it('should initialize with initial object', () => {
    const { result } = renderHook(() => usePersistedObject('test-key', { count: 0 }));

    const [state] = result.current;
    expect(state).toEqual({ count: 0 });
  });

  it('should merge partial updates', async () => {
    const { result } = renderHook(() => usePersistedObject('test-key', { a: 1, b: 2 }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, updateState] = result.current;
      updateState({ a: 10 });
    });

    const [state] = result.current;
    expect(state).toEqual({ a: 10, b: 2 });
  });

  it('should support functional updates', async () => {
    const { result } = renderHook(() => usePersistedObject('test-key', { count: 0 }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, updateState] = result.current;
      updateState((prev) => ({ ...prev, count: prev.count + 1 }));
    });

    const [state] = result.current;
    expect(state).toEqual({ count: 1 });
  });
});

describe('usePersistedArray', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
  });

  it('should initialize with initial array', () => {
    const { result } = renderHook(() => usePersistedArray('test-key', []));

    const [items] = result.current;
    expect(items).toEqual([]);
  });

  it('should push items', async () => {
    const { result } = renderHook(() => usePersistedArray('test-key', []));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, helpers] = result.current;
      helpers.push({ id: 1, name: 'Item 1' });
    });

    const [items] = result.current;
    expect(items).toEqual([{ id: 1, name: 'Item 1' }]);
  });

  it('should remove items by predicate', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ])
    );

    const { result } = renderHook(() => usePersistedArray('test-key', []));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, helpers] = result.current;
      helpers.remove((item) => item.id === 1);
    });

    const [items] = result.current;
    expect(items).toEqual([{ id: 2, name: 'Item 2' }]);
  });

  it('should update items by predicate', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ])
    );

    const { result } = renderHook(() => usePersistedArray('test-key', []));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, helpers] = result.current;
      helpers.update((item) => item.id === 1, { name: 'Updated Item 1' });
    });

    const [items] = result.current;
    expect(items).toEqual([
      { id: 1, name: 'Updated Item 1' },
      { id: 2, name: 'Item 2' },
    ]);
  });

  it('should replace entire array', async () => {
    const { result } = renderHook(() => usePersistedArray('test-key', [1, 2, 3]));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      const [, helpers] = result.current;
      helpers.replace([4, 5, 6]);
    });

    const [items] = result.current;
    expect(items).toEqual([4, 5, 6]);
  });
});
