/**
 * ErrorBanner Component
 * Displays error message with retry functionality
 */

import React from 'react';
import PropTypes from 'prop-types';
import { _View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';

// Constants
const ERROR_ICON_SIZE = 18;
const ERROR_BORDER_WIDTH = 3;
const ERROR_ICON_MARGIN = 10;
const ERROR_TEXT_SIZE = 13;

export default function ErrorBanner({ errorMessage, onRetry }) {
  if (!errorMessage) return null;

  return (
    <TouchableOpacity style={styles.errorBanner} onPress={onRetry} activeOpacity={0.8}>
      <Icon name="warning" size={ERROR_ICON_SIZE} color={COLORS.DANGER_RED} style={styles.errorIcon} />
      <Text style={styles.errorText}>{errorMessage}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ERROR_BG,
    borderLeftWidth: ERROR_BORDER_WIDTH,
    borderLeftColor: COLORS.DANGER_RED,
    paddingVertical: SPACING.sm + SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  errorIcon: {
    marginRight: ERROR_ICON_MARGIN,
  },
  errorText: {
    flex: 1,
    color: COLORS.DANGER_RED,
    fontSize: ERROR_TEXT_SIZE,
    fontWeight: '500',
  },
});

ErrorBanner.propTypes = {
  errorMessage: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
};
