/**
 * MutinynetBanner Component
 * Displays the "Mutinynet Edition" banner at the top of the screen
 */

import React from 'react';
import { View, Text, GestureResponderHandlers } from 'react-native';
import styles from '../styles';

export interface MutinynetBannerProps {
  panHandlers?: GestureResponderHandlers;
  testID?: string;
}

export default function MutinynetBanner({ panHandlers }: MutinynetBannerProps) {
  return (
    <View style={styles.mutinynetBanner} {...panHandlers}>
      <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
    </View>
  );
}
