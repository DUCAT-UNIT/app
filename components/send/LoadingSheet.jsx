/**
 * LoadingSheet Component
 * Bottom sheet showing loading state for transaction operations
 * Used for creating, signing, and broadcasting
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/colors';
import styles from '../../styles';

export default function LoadingSheet({ visible, title, message, dismissible = false, onDismiss }) {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.bottomSheetBackdrop}
        activeOpacity={1}
        onPress={dismissible ? onDismiss : undefined}
      />
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />

        <View style={[styles.amountInputContainer, localStyles.contentContainer]}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} />
          <Text
            style={[
              styles.reviewTitle,
              localStyles.titleText,
              message && localStyles.titleWithMessage,
            ]}
          >
            {title}
          </Text>
          {message && <Text style={[styles.reviewValue, localStyles.messageText]}>{message}</Text>}
        </View>
      </View>
    </>
  );
}

const localStyles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: 20,
  },
  titleText: {
    textAlign: 'center',
  },
  titleWithMessage: {
    marginBottom: 20,
  },
  messageText: {
    textAlign: 'center',
  },
});

LoadingSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
};
