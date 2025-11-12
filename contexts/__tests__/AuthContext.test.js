/**
 * Tests for AuthContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component.update, unmount: component.unmount };
}
import { useAuth as useAuthHook } from '../../hooks/useAuth';

// Mock the useAuth hook
jest.mock('../../hooks/useAuth');

describe('AuthContext', () => {
  const mockAuthState = {
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthHook.mockReturnValue(mockAuthState);
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('should provide auth state from hook', () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toEqual(mockAuthState);
  });

  it('should pass onSeedConfirmed to hook', () => {
    const onSeedConfirmed = jest.fn();
    const wrapper = ({ children }) => (
      <AuthProvider onSeedConfirmed={onSeedConfirmed}>{children}</AuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    expect(useAuthHook).toHaveBeenCalledWith({ onSeedConfirmed });
  });

  it('should provide all hook methods and state', () => {
    const fullAuthState = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123' },
      login: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    };

    useAuthHook.mockReturnValue(fullAuthState);

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toEqual({ id: '123' });
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.refreshAuth).toBe('function');
  });
});
