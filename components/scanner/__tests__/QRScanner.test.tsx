import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import QRScanner from '../QRScanner';

const mockRequestPermission = jest.fn();
const mockOpenSettings = jest.fn();
let mockPermission: { granted: boolean; canAskAgain?: boolean } | null = {
  granted: false,
  canAskAgain: true,
};

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    CameraView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'camera-view' }, children),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock('../../../hooks/useQRScanner', () => ({
  useQRScanner: () => ({
    handleBarCodeScanned: jest.fn(),
    progress: 0,
    isScanning: false,
    totalChunks: 0,
    scannedChunks: new Map(),
    bcurProgress: 0,
  }),
}));

jest.mock('../../icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockIcon({ name }: { name: string }) {
    return React.createElement(Text, null, name);
  };
});

describe('QRScanner permission fallback', () => {
  const onClose = jest.fn();
  const onScan = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: false, canAskAgain: true };
    mockOpenSettings.mockResolvedValue(undefined);
    (Linking as unknown as { openSettings: jest.Mock }).openSettings = mockOpenSettings;
  });

  it('renders close and cancel controls when camera permission is missing', () => {
    const { getByTestId, getByText } = render(
      <QRScanner visible onClose={onClose} onScan={onScan} />
    );

    expect(getByText('Camera Access')).toBeTruthy();

    fireEvent.press(getByTestId('qr-scanner-permission-close'));
    fireEvent.press(getByTestId('qr-scanner-permission-cancel'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('requests camera permission from the continue button', async () => {
    const { getByTestId } = render(<QRScanner visible onClose={onClose} onScan={onScan} />);

    await act(async () => {
      fireEvent.press(getByTestId('qr-scanner-permission-continue'));
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('opens Settings instead of trapping the user when permission is blocked', async () => {
    mockPermission = { granted: false, canAskAgain: false };

    const { getByTestId, getByText } = render(
      <QRScanner visible onClose={onClose} onScan={onScan} />
    );

    expect(getByText('Open Settings')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('qr-scanner-permission-continue'));
    });

    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('mounts the camera view when permission is granted', () => {
    mockPermission = { granted: true, canAskAgain: true };

    const { getByTestId } = render(<QRScanner visible onClose={onClose} onScan={onScan} />);

    expect(getByTestId('camera-view')).toBeTruthy();
  });
});
