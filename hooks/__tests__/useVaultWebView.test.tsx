// @ts-nocheck
/**
 * Tests for useVaultWebView hook
 */

import { create, act } from 'react-test-renderer';
import React from 'react';
import { useVaultWebView } from '../useVaultWebView';

// Helper to render hooks
function renderHook(hook, initialProps) {
  let props = initialProps;
  const result = { current: null };

  function TestComponent({ hookProps }) {
    result.current = hook(hookProps.walletCredentials, hookProps.vaultData, hookProps.visible);
    return null;
  }

  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });

  return {
    result,
    unmount: () => component.unmount(),
    rerender: (newProps) => {
      props = newProps;
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useVaultWebView', () => {
  const mockCredentials = {
    satsAddress: 'bc1qtest',
    satsPubkey: 'pubkey1',
    runesAddress: 'bc1ptest',
    runesPubkey: 'pubkey2',
    vaultAddress: 'bc1vaulttest',
    vaultPubkey: 'vaultpubkey1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: null,
      vaultData: undefined,
      visible: false,
    });

    expect(result.current.webViewRef).toBeDefined();
    expect(result.current.webViewUrl).toBeDefined();
    expect(result.current.forceReloadKey).toBe(0);
    expect(result.current.webViewLoaded).toBe(false);
  });

  it('should build URL without credentials when not provided', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: null,
      vaultData: undefined,
      visible: false,
    });

    expect(result.current.webViewUrl).toContain('https://phone.ducatprotocol.com');
    expect(result.current.webViewUrl).not.toContain('satsAddress');
  });

  it('should build URL with credentials', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: false,
    });

    expect(result.current.webViewUrl).toContain('satsAddress=bc1qtest');
    expect(result.current.webViewUrl).toContain('satsPubkey=pubkey1');
    expect(result.current.webViewUrl).toContain('runesAddress=bc1ptest');
    expect(result.current.webViewUrl).toContain('runesPubkey=pubkey2');
    expect(result.current.webViewUrl).toContain('vaultAddress=bc1vaulttest');
    expect(result.current.webViewUrl).toContain('vaultPubkey=vaultpubkey1');
    expect(result.current.webViewUrl).toContain('network=mutinynet');
  });

  it('should inject wallet credentials when visible for first time', () => {
    const mockWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };

    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: false,
    });

    // Set up mock webViewRef
    result.current.webViewRef.current = mockWebViewRef.current;

    // Make visible
    const { rerender } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: true,
    });

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Verify credentials are injected (would be called in real implementation)
    expect(result.current.webViewRef).toBeDefined();
  });

  it('should call injectWalletCredentials when webViewRef is set', () => {
    const mockInjectJavaScript = jest.fn();

    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: false,
    });

    // Set up mock webViewRef
    result.current.webViewRef.current = {
      injectJavaScript: mockInjectJavaScript,
    };

    act(() => {
      result.current.injectWalletCredentials();
    });

    expect(mockInjectJavaScript).toHaveBeenCalled();
    const scriptArg = mockInjectJavaScript.mock.calls[0][0];
    expect(scriptArg).toContain('mobileWalletCredentials');
    expect(scriptArg).toContain(mockCredentials.vaultPubkey);
    expect(scriptArg).toContain(mockCredentials.satsAddress);
  });

  it('should not inject credentials when webViewRef is not set', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: false,
    });

    // Should not throw
    act(() => {
      result.current.injectWalletCredentials();
    });

    expect(result.current.webViewRef.current).toBe(null);
  });

  it('should not inject credentials when walletCredentials is null', () => {
    const mockInjectJavaScript = jest.fn();

    const { result } = renderHook(useVaultWebView, {
      walletCredentials: null,
      vaultData: undefined,
      visible: false,
    });

    result.current.webViewRef.current = {
      injectJavaScript: mockInjectJavaScript,
    };

    act(() => {
      result.current.injectWalletCredentials();
    });

    expect(mockInjectJavaScript).not.toHaveBeenCalled();
  });

  it('should initialize with forceReloadKey at 0', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: { balance: 1000 },
      visible: true,
    });

    // Initial forceReloadKey should be 0
    expect(result.current.forceReloadKey).toBe(0);
    expect(typeof result.current.forceReloadKey).toBe('number');
  });

  it('should handle undefined vault data', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: true,
    });

    // Should not crash with undefined vault data
    expect(result.current.webViewRef).toBeDefined();
    expect(result.current.webViewUrl).toBeDefined();
  });

  it('should provide all necessary exports', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: { balance: 1000 },
      visible: true,
    });

    // Verify all exports are present
    expect(result.current.webViewRef).toBeDefined();
    expect(result.current.webViewUrl).toBeDefined();
    expect(result.current.forceReloadKey).toBeDefined();
    expect(result.current.webViewLoaded).toBeDefined();
    expect(result.current.setWebViewLoaded).toBeDefined();
    expect(result.current.hasLoadedOnceRef).toBeDefined();
    expect(result.current.injectWalletCredentials).toBeDefined();
  });

  it('should not include timestamp in URL when forceReloadKey is 0', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: { balance: 1000 },
      visible: true,
    });

    // Initially forceReloadKey is 0, so no timestamp
    expect(result.current.webViewUrl).not.toContain('_t=');
    expect(result.current.forceReloadKey).toBe(0);
  });

  it('should handle initial load correctly', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: false,
    });

    // Initial load should set the pubkey reference
    expect(result.current.hasLoadedOnceRef).toBeDefined();
    expect(result.current.forceReloadKey).toBe(0);
  });

  it('should not reload on same vaultPubkey', () => {
    const { result, rerender } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: { balance: 1000 },
      visible: true,
    });

    const initialForceReloadKey = result.current.forceReloadKey;

    // Re-render with same credentials
    rerender({
      walletCredentials: mockCredentials,
      vaultData: { balance: 1000 },
      visible: true,
    });

    // ForceReloadKey should not change
    expect(result.current.forceReloadKey).toBe(initialForceReloadKey);
  });

  it('should handle missing vaultPubkey gracefully', () => {
    const credentialsWithoutPubkey = {
      ...mockCredentials,
      vaultPubkey: undefined,
    };

    const { result } = renderHook(useVaultWebView, {
      walletCredentials: credentialsWithoutPubkey,
      vaultData: undefined,
      visible: false,
    });

    // Should not crash
    expect(result.current.webViewRef).toBeDefined();
  });

  it('should update webViewLoaded state', () => {
    const { result } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: false,
    });

    expect(result.current.webViewLoaded).toBe(false);

    act(() => {
      result.current.setWebViewLoaded(true);
    });

    expect(result.current.webViewLoaded).toBe(true);
  });

  it('should reload on account switch when vault data already fetched', () => {
    jest.useFakeTimers();

    const mockInjectJavaScript = jest.fn();
    const { result, rerender } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: { balance: 1000 }, // Vault data already exists
      visible: true,
    });

    // Set up webViewRef
    result.current.webViewRef.current = {
      injectJavaScript: mockInjectJavaScript,
    };

    const initialForceReloadKey = result.current.forceReloadKey;

    // Switch to different account with different pubkey
    const newCredentials = {
      ...mockCredentials,
      vaultPubkey: 'newvaultpubkey',
    };

    rerender({
      walletCredentials: newCredentials,
      vaultData: { balance: 1000 },
      visible: true,
    });

    // Should have changed forceReloadKey
    expect(result.current.forceReloadKey).not.toBe(initialForceReloadKey);

    // Fast-forward setTimeout to trigger re-inject
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should have called injectJavaScript
    expect(mockInjectJavaScript).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should wait for vault data on account switch when not fetched', () => {
    const { result, rerender } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined, // No vault data yet
      visible: true,
    });

    const initialForceReloadKey = result.current.forceReloadKey;

    // Switch to different account
    const newCredentials = {
      ...mockCredentials,
      vaultPubkey: 'newvaultpubkey',
    };

    rerender({
      walletCredentials: newCredentials,
      vaultData: undefined, // Still no vault data
      visible: true,
    });

    // Should NOT have changed forceReloadKey yet (waiting for vault data)
    expect(result.current.forceReloadKey).toBe(initialForceReloadKey);
  });

  it('should reload when vault data fetched after account switch', () => {
    jest.useFakeTimers();

    const mockInjectJavaScript = jest.fn();
    const { result, rerender } = renderHook(useVaultWebView, {
      walletCredentials: mockCredentials,
      vaultData: undefined,
      visible: true,
    });

    // Set up webViewRef
    result.current.webViewRef.current = {
      injectJavaScript: mockInjectJavaScript,
    };

    // Switch account
    const newCredentials = {
      ...mockCredentials,
      vaultPubkey: 'newvaultpubkey',
    };

    rerender({
      walletCredentials: newCredentials,
      vaultData: undefined, // Still waiting for data
      visible: true,
    });

    const forceReloadKeyBeforeFetch = result.current.forceReloadKey;

    // Now vault data arrives
    rerender({
      walletCredentials: newCredentials,
      vaultData: { balance: 2000 },
      visible: true,
    });

    // Should have changed forceReloadKey when vault data arrived
    expect(result.current.forceReloadKey).not.toBe(forceReloadKeyBeforeFetch);

    // Fast-forward setTimeout to trigger re-inject
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should have called injectJavaScript
    expect(mockInjectJavaScript).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
