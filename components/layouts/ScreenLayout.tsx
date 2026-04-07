/**
 * ScreenLayout Component
 * Wraps screen content with optional MutinynetBanner and StatusBar.
 */

import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MutinynetBanner from '../MutinynetBanner';
import { COLORS } from '../../theme';

interface ScreenLayoutProps {
  children: React.ReactNode;
  showBanner?: boolean;
  testID?: string;
  style?: object;
}

export default function ScreenLayout({
  children,
  showBanner = true,
  testID,
  style,
}: ScreenLayoutProps): React.ReactElement {
  return (
    <View style={[layoutStyles.container, style]} testID={testID}>
      {showBanner && <MutinynetBanner />}
      {children}
      <StatusBar style="light" />
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
});
