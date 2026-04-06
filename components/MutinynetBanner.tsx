/**
 * MutinynetBanner Component
 * Displays the network edition banner at the top of the screen.
 * Text, colors, and visibility are driven by the remote config store.
 */

import React from 'react';
import { View, Text, GestureResponderHandlers } from 'react-native';
import styles from '../styles';
import { NETWORK_EDITION_LABEL } from '../utils/constants';
import { useBannerConfig } from '../stores/remoteConfigStore';

export interface MutinynetBannerProps {
  panHandlers?: GestureResponderHandlers;
  testID?: string;
}

export default function MutinynetBanner({ panHandlers }: MutinynetBannerProps) {
  const bannerConfig = useBannerConfig();

  if (!bannerConfig.visible) {
    return null;
  }

  return (
    <View
      style={[
        styles.mutinynetBanner,
        bannerConfig.backgroundColor ? { backgroundColor: bannerConfig.backgroundColor } : undefined,
      ]}
      {...panHandlers}
    >
      <Text
        style={[
          styles.mutinynetBannerText,
          bannerConfig.textColor ? { color: bannerConfig.textColor } : undefined,
        ]}
      >
        {bannerConfig.text || NETWORK_EDITION_LABEL}
      </Text>
    </View>
  );
}
