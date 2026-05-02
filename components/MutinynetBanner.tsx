/**
 * MutinynetBanner Component
 * Displays the network edition banner at the top of the screen.
 */

import React from 'react';
import { View, Text, GestureResponderHandlers } from 'react-native';
import styles from '../styles';
import { NETWORK_EDITION_LABEL } from '../utils/constants';

export interface MutinynetBannerProps {
  panHandlers?: GestureResponderHandlers;
  testID?: string;
}

export default function MutinynetBanner({ panHandlers }: MutinynetBannerProps) {
  return (
    <View
      style={styles.mutinynetBanner}
      {...panHandlers}
    >
      <Text style={styles.mutinynetBannerText}>{NETWORK_EDITION_LABEL}</Text>
    </View>
  );
}
