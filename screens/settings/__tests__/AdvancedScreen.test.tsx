/**
 * Tests for AdvancedScreen
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AdvancedScreen from '../AdvancedScreen';

const mockSettingsHandlers = {
  advancedMode: false,
  ecashThreshold: 10000,
  usdcFeaturesEnabled: false,
  handleAdvancedModeToggle: jest.fn(),
  handleDisableUsdcFeatures: jest.fn(),
  handleEnableUsdcFeatures: jest.fn(),
};

jest.mock('../../../contexts/NavigationHandlersContext', () => ({
  useSettingsHandlers: () => ({
    settingsHandlers: mockSettingsHandlers,
  }),
}));

jest.mock('../../../stores/operationJournalStore', () => ({
  useOperationJournalStore: jest.fn((selector) =>
    selector({
      entries: [],
      clearTerminalOlderThan: jest.fn(),
    })
  ),
}));

jest.mock('../../../services/analyticsService', () => ({
  analytics: {
    track: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../components/icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockIcon({ name, testID }: { name: string; testID?: string }) {
    return React.createElement(View, { testID: testID || `icon-${name}` });
  };
});

jest.mock('../../../components/layouts/ScreenLayout', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockScreenLayout({
    children,
    testID,
  }: {
    children: React.ReactNode;
    testID?: string;
  }) {
    return React.createElement(View, { testID }, children);
  };
});

describe('AdvancedScreen', () => {
  const staleRouteToggle = jest.fn();
  const defaultProps = {
    route: {
      params: {
        onClose: jest.fn(),
        onSwitchAccount: jest.fn(),
        onAdvancedModeToggle: staleRouteToggle,
        onEcashThresholdPress: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsHandlers.advancedMode = false;
    mockSettingsHandlers.ecashThreshold = 10000;
    mockSettingsHandlers.usdcFeaturesEnabled = false;
    mockSettingsHandlers.handleAdvancedModeToggle = jest.fn();
    mockSettingsHandlers.handleDisableUsdcFeatures = jest.fn();
    mockSettingsHandlers.handleEnableUsdcFeatures = jest.fn();
  });

  it('uses the live settings handler when toggling developer mode', () => {
    const firstLiveToggle = mockSettingsHandlers.handleAdvancedModeToggle;
    const { getByTestId, rerender } = render(<AdvancedScreen {...defaultProps} />);

    fireEvent.press(getByTestId('advanced-dev-mode-btn'));

    expect(firstLiveToggle).toHaveBeenCalledTimes(1);
    expect(staleRouteToggle).not.toHaveBeenCalled();

    const secondLiveToggle = jest.fn();
    mockSettingsHandlers.advancedMode = true;
    mockSettingsHandlers.handleAdvancedModeToggle = secondLiveToggle;
    rerender(<AdvancedScreen {...defaultProps} />);

    fireEvent.press(getByTestId('advanced-dev-mode-btn'));

    expect(secondLiveToggle).toHaveBeenCalledTimes(1);
    expect(staleRouteToggle).not.toHaveBeenCalled();
  });
});
