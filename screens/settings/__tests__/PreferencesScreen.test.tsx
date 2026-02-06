/**
 * Tests for PreferencesScreen
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PreferencesScreen from '../PreferencesScreen';

// Mock NavigationHandlersContext
const mockSettingsHandlers = {
  handleShowZeroAssetsToggle: jest.fn(),
  handleNotificationsToggle: jest.fn(),
  showZeroAssets: true,
  notificationsEnabled: false,
};

jest.mock('../../../contexts/NavigationHandlersContext', () => ({
  useNavigationHandlers: () => ({
    settingsHandlers: mockSettingsHandlers,
  }),
}));

// Mock Icon component
jest.mock('../../../components/icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockIcon({ name, testID }: { name: string; testID?: string }) {
    return React.createElement(View, { testID: testID || `icon-${name}` });
  };
});

// Mock MutinynetBanner
jest.mock('../../../components/MutinynetBanner', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockMutinynetBanner() {
    return React.createElement(View, { testID: 'mutinynet-banner' });
  };
});

describe('PreferencesScreen', () => {
  const mockOnClose = jest.fn();

  const defaultProps = {
    route: {
      params: {
        onClose: mockOnClose,
        onShowZeroAssetsToggle: jest.fn(),
        onNotificationsToggle: jest.fn(),
        showZeroAssets: true,
        notificationsEnabled: false,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render preferences screen', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      expect(getByTestId('preferences-screen')).toBeTruthy();
    });

    it('should render title "Preferences"', () => {
      const { getByText } = render(<PreferencesScreen {...defaultProps} />);
      expect(getByText('Preferences')).toBeTruthy();
    });

    it('should render back button', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      expect(getByTestId('preferences-back-btn')).toBeTruthy();
    });

    it('should render preference options', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);

      expect(getByTestId('preferences-zero-assets-btn')).toBeTruthy();
      expect(getByTestId('preferences-notifications-btn')).toBeTruthy();
    });
  });

  describe('navigation callbacks', () => {
    it('should call onClose when back button is pressed', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);

      fireEvent.press(getByTestId('preferences-back-btn'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call handleShowZeroAssetsToggle when Show Zero Value Assets is pressed', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);

      fireEvent.press(getByTestId('preferences-zero-assets-btn'));

      expect(mockSettingsHandlers.handleShowZeroAssetsToggle).toHaveBeenCalledTimes(1);
    });

    it('should call handleNotificationsToggle when Notifications is pressed', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);

      fireEvent.press(getByTestId('preferences-notifications-btn'));

      expect(mockSettingsHandlers.handleNotificationsToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('preference status display', () => {
    it('should show ON status in accessibility label for showZeroAssets when enabled', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      const zeroAssetsBtn = getByTestId('preferences-zero-assets-btn');
      // ON/OFF text is inside accessibilityElementsHidden, so check via accessibility label
      expect(zeroAssetsBtn.props.accessibilityLabel).toContain('ON');
    });

    it('should show OFF status in accessibility label for notifications when disabled', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      const notificationsBtn = getByTestId('preferences-notifications-btn');
      // ON/OFF text is inside accessibilityElementsHidden, so check via accessibility label
      expect(notificationsBtn.props.accessibilityLabel).toContain('OFF');
    });
  });

  describe('accessibility', () => {
    it('should have accessible back button', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      const backButton = getByTestId('preferences-back-btn');

      expect(backButton.props.accessibilityRole).toBe('button');
      expect(backButton.props.accessibilityLabel).toBe('Go back');
    });

    it('should have accessible zero assets toggle with state', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      const zeroAssetsBtn = getByTestId('preferences-zero-assets-btn');

      expect(zeroAssetsBtn.props.accessibilityRole).toBe('button');
      expect(zeroAssetsBtn.props.accessibilityLabel).toBe('Show Zero Value Assets, currently ON');
    });

    it('should have accessible notifications toggle with state', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      const notificationsBtn = getByTestId('preferences-notifications-btn');

      expect(notificationsBtn.props.accessibilityRole).toBe('button');
      expect(notificationsBtn.props.accessibilityLabel).toBe('Notifications, currently OFF');
    });

    it('should have hint on preference buttons', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);
      const zeroAssetsBtn = getByTestId('preferences-zero-assets-btn');

      expect(zeroAssetsBtn.props.accessibilityHint).toBe('Tap to toggle this setting');
    });
  });

  describe('menu item display', () => {
    it('should display menu items with correct accessibility labels', () => {
      const { getByTestId } = render(<PreferencesScreen {...defaultProps} />);

      // Menu items have text in accessibilityElementsHidden, so check accessibility labels
      expect(getByTestId('preferences-zero-assets-btn').props.accessibilityLabel).toContain('Show Zero Value Assets');
      expect(getByTestId('preferences-notifications-btn').props.accessibilityLabel).toContain('Notifications');
    });
  });
});
