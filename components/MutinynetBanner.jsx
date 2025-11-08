/**
 * MutinynetBanner Component
 * Displays the "Mutinynet Edition" banner at the top of the screen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';
import styles from '../styles';

export default function MutinynetBanner({ panHandlers }) {
  return (
    <View style={styles.mutinynetBanner} {...panHandlers}>
      <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
    </View>
  );
}

MutinynetBanner.propTypes = {
  panHandlers: PropTypes.object,
};
