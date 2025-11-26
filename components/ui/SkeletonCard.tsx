/**
 * SkeletonCard
 * Skeleton loader shaped like wallet asset card
 *
 * Architecture: Molecule component (< 250 lines)
 * Props: 1 (style)
 * State: 0
 * Complexity: Composition of SkeletonLoader atoms
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import SkeletonLoader from './SkeletonLoader';
import { COLORS, SPACING } from '../../theme';

interface SkeletonCardProps {
  style?: StyleProp<ViewStyle>;
}

const SkeletonCard = ({ style }: SkeletonCardProps) => {
  return (
    <View style={[styles.card, style]}>
      {/* Icon placeholder */}
      <View style={styles.header}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <SkeletonLoader width="60%" height={16} style={styles.spacing} />
          <SkeletonLoader width="40%" height={14} />
        </View>
      </View>

      {/* Balance placeholder */}
      <View style={styles.balance}>
        <SkeletonLoader width="80%" height={32} style={styles.spacing} />
        <SkeletonLoader width="50%" height={18} />
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerText: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  balance: {
    marginTop: SPACING.sm,
  },
  spacing: {
    marginBottom: SPACING.xs,
  },
});

export default React.memo(SkeletonCard);
