/**
 * Tests for SettingsScreen
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock cacheService
jest.mock('../../../services/cacheService', () => ({
  clearAppCache: jest.fn().mockResolvedValue({ errors: [] }),
}));

// Mock Icon component
jest.mock('../../../components/icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockIcon({ name, testID }: { name: string; testID?: string }) {
    return React.createElement(View, { testID: testID || `icon-${name}` });
  };
});

describe('SettingsScreen', () => {
  const mockOnClose = jest.fn();
  const mockOnLockWallet = jest.fn();
  const mockOnViewPreferences = jest.fn();
  const mockOnViewSecurity = jest.fn();
  const mockOnViewAdvanced = jest.fn();
  const mockOnViewCashuSettings = jest.fn();
  const mockOnViewAbout = jest.fn();

  const defaultProps = {
    onClose: mockOnClose,
    onLockWallet: mockOnLockWallet,
    onViewPreferences: mockOnViewPreferences,
    onViewSecurity: mockOnViewSecurity,
    onViewAdvanced: mockOnViewAdvanced,
    onViewCashuSettings: mockOnViewCashuSettings,
    onViewAbout: mockOnViewAbout,
    advancedMode: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render settings screen', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
      expect(getByTestId('settings-screen')).toBeTruthy();
    });

    it('should render title "Settings"', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      expect(getByText('Settings')).toBeTruthy();
    });

    it('should render back button', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
      expect(getByTestId('settings-back-btn')).toBeTruthy();
    });

    it('should render all basic menu options', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      expect(getByTestId('settings-preferences-btn')).toBeTruthy();
      expect(getByTestId('settings-security-btn')).toBeTruthy();
      expect(getByTestId('settings-advanced-btn')).toBeTruthy();
      expect(getByTestId('settings-lock-btn')).toBeTruthy();
      expect(getByTestId('settings-about-btn')).toBeTruthy();
    });

    it('should not render Cashu settings when advancedMode is false', () => {
      const { queryByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={false} />);
      expect(queryByTestId('settings-cashu-btn')).toBeNull();
    });

    it('should not render Cashu settings when advancedMode is true', () => {
      const { queryByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={true} />);
      expect(queryByTestId('settings-cashu-btn')).toBeNull();
    });

    it('should not render clear cache button when advancedMode is false', () => {
      const { queryByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={false} />);
      expect(queryByTestId('settings-clear-cache-btn')).toBeNull();
    });

    it('should render clear cache button when advancedMode is true', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={true} />);
      expect(getByTestId('settings-clear-cache-btn')).toBeTruthy();
    });
  });

  describe('navigation callbacks', () => {
    it('should call onClose when back button is pressed', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByTestId('settings-back-btn'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onViewPreferences when Preferences is pressed', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByTestId('settings-preferences-btn'));

      expect(mockOnViewPreferences).toHaveBeenCalledTimes(1);
    });

    it('should call onViewSecurity when Security is pressed', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByTestId('settings-security-btn'));

      expect(mockOnViewSecurity).toHaveBeenCalledTimes(1);
    });

    it('should call onViewAdvanced when Advanced is pressed', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByTestId('settings-advanced-btn'));

      expect(mockOnViewAdvanced).toHaveBeenCalledTimes(1);
    });

    it('should call onLockWallet when Lock Wallet is pressed', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByTestId('settings-lock-btn'));

      expect(mockOnLockWallet).toHaveBeenCalledTimes(1);
    });

    it('should call onViewAbout when About is pressed', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByTestId('settings-about-btn'));

      expect(mockOnViewAbout).toHaveBeenCalledTimes(1);
    });

    it('should keep Cashu Settings hidden in advanced mode', () => {
      const { queryByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={true} />);
      expect(queryByTestId('settings-cashu-btn')).toBeNull();
      expect(mockOnViewCashuSettings).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible back button', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
      const backButton = getByTestId('settings-back-btn');

      expect(backButton.props.accessibilityRole).toBe('button');
      expect(backButton.props.accessibilityLabel).toBe('Go back');
    });

    it('should have accessible menu options', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      const preferencesBtn = getByTestId('settings-preferences-btn');
      expect(preferencesBtn.props.accessibilityRole).toBe('button');
      expect(preferencesBtn.props.accessibilityLabel).toBe('Preferences');

      const securityBtn = getByTestId('settings-security-btn');
      expect(securityBtn.props.accessibilityRole).toBe('button');
      expect(securityBtn.props.accessibilityLabel).toBe('Security');
    });

    it('should have accessible clear cache button when in advanced mode', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={true} />);
      const clearCacheBtn = getByTestId('settings-clear-cache-btn');

      expect(clearCacheBtn.props.accessibilityRole).toBe('button');
      expect(clearCacheBtn.props.accessibilityLabel).toBe('Clear app cache');
    });
  });

  describe('menu item display', () => {
    it('should display menu items with correct accessibility labels', () => {
      const { getByTestId } = render(<SettingsScreen {...defaultProps} />);

      // Menu items have text in accessibilityElementsHidden, so check accessibility labels
      expect(getByTestId('settings-preferences-btn').props.accessibilityLabel).toBe('Preferences');
      expect(getByTestId('settings-security-btn').props.accessibilityLabel).toBe('Security');
      expect(getByTestId('settings-advanced-btn').props.accessibilityLabel).toBe('Advanced');
      expect(getByTestId('settings-lock-btn').props.accessibilityLabel).toBe('Lock Wallet');
      expect(getByTestId('settings-about-btn').props.accessibilityLabel).toBe('About');
    });

    it('should not display Turbo Cashu option in advanced mode', () => {
      const { queryByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={true} />);
      expect(queryByTestId('settings-cashu-btn')).toBeNull();
    });

    it('should display danger zone section in advanced mode', () => {
      const { getByText, getByTestId } = render(<SettingsScreen {...defaultProps} advancedMode={true} />);
      expect(getByText('Danger Zone')).toBeTruthy();
      // Clear App Cache is in a nested structure, verify by testID
      expect(getByTestId('settings-clear-cache-btn')).toBeTruthy();
    });
  });
});
