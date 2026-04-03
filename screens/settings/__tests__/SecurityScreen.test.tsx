/**
 * Tests for SecurityScreen
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SecurityScreen from '../SecurityScreen';

// Mock NavigationHandlersContext
const mockSettingsHandlers = {
  handleFaceIdToggle: jest.fn(),
  handleChangePin: jest.fn(),
  handleViewSeedPhrase: jest.fn(),
  handleDeleteWallet: jest.fn(),
};

const mockSettingsContext = {
  settingsHandlers: mockSettingsHandlers,
  biometricEnabled: true,
  passkeyUpgradeRecommended: false,
  triggerPasskeyUpgrade: jest.fn(),
};

jest.mock('../../../contexts/NavigationHandlersContext', () => ({
  useSettingsHandlers: () => mockSettingsContext,
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

describe('SecurityScreen', () => {
  const mockOnClose = jest.fn();

  const defaultProps = {
    route: {
      params: {
        onClose: mockOnClose,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsContext.biometricEnabled = true;
    mockSettingsContext.passkeyUpgradeRecommended = false;
  });

  describe('rendering', () => {
    it('should render security screen', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      expect(getByTestId('security-screen')).toBeTruthy();
    });

    it('should render title "Security"', () => {
      const { getByText } = render(<SecurityScreen {...defaultProps} />);
      expect(getByText('Security')).toBeTruthy();
    });

    it('should render back button', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      expect(getByTestId('security-back-btn')).toBeTruthy();
    });

    it('should render all security options', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      expect(getByTestId('security-biometric-btn')).toBeTruthy();
      expect(getByTestId('security-change-pin-btn')).toBeTruthy();
      expect(getByTestId('security-backup-btn')).toBeTruthy();
      expect(() => getByTestId('security-passkey-upgrade-btn')).toThrow();
    });

    it('should render danger zone with delete wallet option', () => {
      const { getByTestId, getByText } = render(<SecurityScreen {...defaultProps} />);

      expect(getByText('Danger Zone')).toBeTruthy();
      expect(getByTestId('security-delete-btn')).toBeTruthy();
    });
  });

  describe('navigation callbacks', () => {
    it('should call onClose when back button is pressed', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      fireEvent.press(getByTestId('security-back-btn'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call handleFaceIdToggle when biometric is pressed', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      fireEvent.press(getByTestId('security-biometric-btn'));

      expect(mockSettingsHandlers.handleFaceIdToggle).toHaveBeenCalledTimes(1);
    });

    it('should call handleChangePin when Change PIN is pressed', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      fireEvent.press(getByTestId('security-change-pin-btn'));

      expect(mockSettingsHandlers.handleChangePin).toHaveBeenCalledTimes(1);
    });

    it('should call handleViewSeedPhrase when Backup Wallet is pressed', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      fireEvent.press(getByTestId('security-backup-btn'));

      expect(mockSettingsHandlers.handleViewSeedPhrase).toHaveBeenCalledTimes(1);
    });

    it('should call handleDeleteWallet when Delete Local Wallet is pressed', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      fireEvent.press(getByTestId('security-delete-btn'));

      expect(mockSettingsHandlers.handleDeleteWallet).toHaveBeenCalledTimes(1);
    });

    it('should call triggerPasskeyUpgrade when upgrade option is pressed', () => {
      mockSettingsContext.passkeyUpgradeRecommended = true;
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      fireEvent.press(getByTestId('security-passkey-upgrade-btn'));

      expect(mockSettingsContext.triggerPasskeyUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  describe('biometric status', () => {
    it('should show biometric button with ON status in accessibility label', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      const biometricBtn = getByTestId('security-biometric-btn');
      // ON/OFF text is inside accessibilityElementsHidden, so check via accessibility label
      expect(biometricBtn.props.accessibilityLabel).toContain('ON');
    });

    it('should render biometric option correctly', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      const biometricBtn = getByTestId('security-biometric-btn');
      expect(biometricBtn).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have accessible back button', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      const backButton = getByTestId('security-back-btn');

      expect(backButton.props.accessibilityRole).toBe('button');
      expect(backButton.props.accessibilityLabel).toBe('Go back');
    });

    it('should have accessible biometric button with state', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      const biometricBtn = getByTestId('security-biometric-btn');

      expect(biometricBtn.props.accessibilityRole).toBe('button');
      expect(biometricBtn.props.accessibilityLabel).toBe('Biometric Authentication, currently ON');
    });

    it('should have accessible delete wallet button with warning hint', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);
      const deleteBtn = getByTestId('security-delete-btn');

      expect(deleteBtn.props.accessibilityRole).toBe('button');
      expect(deleteBtn.props.accessibilityHint).toBe(
        'Warning: Deletes wallet data from this device. Passkey backup is not removed.'
      );
    });
  });

  describe('menu item display', () => {
    it('should display menu items with correct accessibility labels', () => {
      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      // Menu items have text in accessibilityElementsHidden, so check accessibility labels
      expect(getByTestId('security-biometric-btn').props.accessibilityLabel).toContain('Biometric Authentication');
      expect(getByTestId('security-change-pin-btn').props.accessibilityLabel).toBe('Change PIN');
      expect(getByTestId('security-backup-btn').props.accessibilityLabel).toBe('Backup Wallet');
      expect(getByTestId('security-delete-btn').props.accessibilityLabel).toBe('Delete Local Wallet');
    });

    it('should render the passkey upgrade option when recommended', () => {
      mockSettingsContext.passkeyUpgradeRecommended = true;

      const { getByTestId } = render(<SecurityScreen {...defaultProps} />);

      expect(getByTestId('security-passkey-upgrade-btn').props.accessibilityLabel)
        .toBe('Upgrade Passkey Security, currently RECOMMENDED');
    });
  });
});
