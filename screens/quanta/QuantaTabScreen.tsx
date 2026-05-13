/**
 * QuantaTabScreen
 * Main-tab wrapper around the Quanta reward linking screen.
 */

import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Keyboard, StyleSheet, View } from 'react-native';
import QuantaLinkScreen from '../settings/QuantaLinkScreen';
import { COLORS } from '../../theme';

export default function QuantaTabScreen(): React.ReactElement {
  const isFocused = useIsFocused();

  React.useEffect(() => {
    if (!isFocused) {
      Keyboard.dismiss();
    }
  }, [isFocused]);

  return (
    <View style={styles.container}>
      <QuantaLinkScreen showBackButton={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
});
