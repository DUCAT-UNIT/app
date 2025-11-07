/**
 * SplashScreen Component
 * Displays the Ducat logo on app launch and when app is backgrounded
 */

import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from './Icon';
import styles from '../styles';

export default function SplashScreen() {
  return (
    <View style={styles.splashContainer}>
      <Icon name="ducat_logo" size={100} />
      <StatusBar style="light" />
    </View>
  );
}
