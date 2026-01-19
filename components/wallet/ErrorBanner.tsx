/**
 * ErrorBanner Component
 * Displays error message with retry functionality
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';

// Constants
const ERROR_ICON_SIZE = 18;
const ERROR_BORDER_WIDTH = 3;
const ERROR_ICON_MARGIN = 20;
const ERROR_TEXT_SIZE = 13;

interface ErrorBannerProps {
  errorMessage?: string | null;
  onRetry: () => void;
}

export default memo(function ErrorBanner({ errorMessage, onRetry }: ErrorBannerProps) {
  if (!errorMessage) return null;

  return (
    <TouchableOpacity style={styles.errorBanner} onPress={onRetry} activeOpacity={0.8}>
      <View style={styles.errorIconContainer}>
        <Icon name="warning" size={ERROR_ICON_SIZE} color={COLORS.DANGER_RED} />
      </View>
      <Text style={styles.errorText}>{errorMessage}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  errorIconContainer: {
    marginRight: ERROR_ICON_MARGIN,
    marginTop: 2,
  },
  errorText: {
    flex: 1,
    flexWrap: 'wrap',
    color: COLORS.DANGER_RED,
    fontSize: ERROR_TEXT_SIZE,
    fontWeight: '500',
    lineHeight: ERROR_TEXT_SIZE * 1.4,
  },
});
