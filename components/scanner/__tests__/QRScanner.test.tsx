import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import QRScanner from '../QRScanner';

const mockRequestPermission = jest.fn();
let mockPermission = { granted: false };

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock('../../icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return {
    __esModule: true,
    default: MockIcon,
  };
});

jest.mock('../../../hooks/useQRScanner', () => ({
  useQRScanner: () => ({
    handleBarCodeScanned: jest.fn(),
    progress: 0,
    isScanning: false,
    totalChunks: 0,
    scannedChunks: new Set(),
    bcurProgress: 0,
  }),
}));

describe('QRScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: false };
  });

  it('lets users close the camera permission gate without granting access', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <QRScanner visible={true} onClose={onClose} onScan={jest.fn()} />
    );

    fireEvent.press(getByTestId('qr-scanner-permission-close-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('still requests camera permission from the continue button', () => {
    const { getByTestId } = render(
      <QRScanner visible={true} onClose={jest.fn()} onScan={jest.fn()} />
    );

    fireEvent.press(getByTestId('qr-scanner-permission-continue-btn'));

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });
});
