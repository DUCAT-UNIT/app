/**
 * Tests for vaultWebViewScripts
 */

import { consoleLogScript, vaultLoadedDetectionScript, combinedInjectedScript } from '../vaultWebViewScripts';

describe('vaultWebViewScripts', () => {
  it('should export consoleLogScript', () => {
    expect(consoleLogScript).toBeDefined();
    expect(typeof consoleLogScript).toBe('string');
    expect(consoleLogScript).toContain('console.log');
    expect(consoleLogScript).toContain('console.warn');
    expect(consoleLogScript).toContain('console.error');
  });

  it('should export vaultLoadedDetectionScript', () => {
    expect(vaultLoadedDetectionScript).toBeDefined();
    expect(typeof vaultLoadedDetectionScript).toBe('string');
    expect(vaultLoadedDetectionScript).toContain('Vault health');
    expect(vaultLoadedDetectionScript).toContain('Create Vault');
  });

  it('should export combinedInjectedScript', () => {
    expect(combinedInjectedScript).toBeDefined();
    expect(typeof combinedInjectedScript).toBe('string');
    expect(combinedInjectedScript).toContain('console.log');
    expect(combinedInjectedScript).toContain('Vault health');
  });

  it('consoleLogScript should intercept console methods', () => {
    expect(consoleLogScript).toContain('originalLog');
    expect(consoleLogScript).toContain('originalWarn');
    expect(consoleLogScript).toContain('originalError');
    expect(consoleLogScript).toContain('ReactNativeWebView');
  });

  it('vaultLoadedDetectionScript should check for vault elements', () => {
    expect(vaultLoadedDetectionScript).toContain('Vault health');
    expect(vaultLoadedDetectionScript).toContain('Create Vault');
    expect(vaultLoadedDetectionScript).toContain('hasMainContent');
    expect(vaultLoadedDetectionScript).toContain('MutationObserver');
  });

  it('combinedInjectedScript should include both scripts', () => {
    expect(combinedInjectedScript.length).toBeGreaterThan(consoleLogScript.length);
    expect(combinedInjectedScript.length).toBeGreaterThan(vaultLoadedDetectionScript.length);
  });
});
