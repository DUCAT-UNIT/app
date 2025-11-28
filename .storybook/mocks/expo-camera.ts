// Mock for expo-camera
import React from 'react';
import { View } from 'react-native';

export const CameraView = View;
export const Camera = View;

export const useCameraPermissions = () => [
  { granted: false, canAskAgain: true },
  async () => ({ granted: true, canAskAgain: true }),
];

export const CameraType = {
  front: 'front',
  back: 'back',
};

export const FlashMode = {
  off: 'off',
  on: 'on',
  auto: 'auto',
  torch: 'torch',
};

export default { CameraView, Camera, useCameraPermissions, CameraType, FlashMode };
