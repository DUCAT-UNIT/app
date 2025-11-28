// Mock for react-native-qrcode-svg
import React from 'react';
import { View, Text } from 'react-native';

interface QRCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

const QRCode = ({ value, size = 100 }: QRCodeProps) =>
  React.createElement(View, {
    style: {
      width: size,
      height: size,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ccc',
    }
  }, React.createElement(Text, { style: { fontSize: 10, textAlign: 'center' } }, `QR: ${value.substring(0, 20)}...`));

export default QRCode;
