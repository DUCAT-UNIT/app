import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================
const ProgressBar = ({
  ecashAmount,
  unitAmount,
  totalLabel,
}: {
  ecashAmount: number;
  unitAmount: number;
  totalLabel: string;
}) => {
  const total = ecashAmount + unitAmount;
  const ecashPercent = total > 0 ? (ecashAmount / total) * 100 : 0;
  const unitPercent = total > 0 ? (unitAmount / total) * 100 : 0;

  return (
    <View style={styles.progressWrapper}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{totalLabel}</Text>
        <Text style={styles.progressTotal}>{total.toLocaleString()} UNIT</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, styles.ecashFill, { width: `${ecashPercent}%` }]} />
        <View style={[styles.progressFill, styles.unitFill, { width: `${unitPercent}%` }]} />
      </View>
      <View style={styles.progressLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.TEAL }]} />
          <Text style={styles.legendLabel}>eCash</Text>
          <Text style={styles.legendValue}>{ecashAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.PRIMARY_BLUE }]} />
          <Text style={styles.legendLabel}>UNIT</Text>
          <Text style={styles.legendValue}>{unitAmount.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// CIRCULAR PROGRESS
// ============================================================================
const CircularProgress = ({
  ecashPercent,
  size = 120,
}: {
  ecashPercent: number;
  size?: number;
}) => {
  const unitPercent = 100 - ecashPercent;

  return (
    <View style={[styles.circularWrapper, { width: size, height: size }]}>
      <View style={styles.circularOuter}>
        <View style={[styles.circularSegment, styles.ecashSegment, {
          transform: [{ rotate: '0deg' }],
          borderTopColor: ecashPercent > 0 ? COLORS.TEAL : 'transparent',
          borderRightColor: ecashPercent > 25 ? COLORS.TEAL : 'transparent',
          borderBottomColor: ecashPercent > 50 ? COLORS.TEAL : 'transparent',
          borderLeftColor: ecashPercent > 75 ? COLORS.TEAL : 'transparent',
        }]} />
      </View>
      <View style={styles.circularInner}>
        <Text style={styles.circularLabel}>eCash</Text>
        <Text style={styles.circularValue}>{ecashPercent}%</Text>
      </View>
    </View>
  );
};

// ============================================================================
// BREAKDOWN CARD
// ============================================================================
const BreakdownCard = ({
  icon,
  label,
  amount,
  color,
  percent,
}: {
  icon: string;
  label: string;
  amount: string;
  color: string;
  percent: number;
}) => (
  <View style={styles.breakdownCard}>
    <View style={[styles.breakdownIcon, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={24} color={color} />
    </View>
    <View style={styles.breakdownContent}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownAmount}>{amount}</Text>
    </View>
    <View style={styles.breakdownPercent}>
      <Text style={[styles.percentValue, { color }]}>{percent}%</Text>
    </View>
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const ProgressStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Progress</Text>
    <Text style={styles.description}>
      Visual representation of eCash vs UNIT balance distribution.
    </Text>

    <Text style={styles.sectionLabel}>BALANCE BREAKDOWN</Text>
    <ProgressBar ecashAmount={7500} unitAmount={4845} totalLabel="Total UNIT Balance" />

    <Text style={styles.sectionLabel}>DISTRIBUTION STATES</Text>
    <View style={styles.statesGrid}>
      <View style={styles.stateItem}>
        <Text style={styles.stateLabel}>Mostly eCash</Text>
        <ProgressBar ecashAmount={8000} unitAmount={2000} totalLabel="" />
      </View>
      <View style={styles.stateItem}>
        <Text style={styles.stateLabel}>Balanced</Text>
        <ProgressBar ecashAmount={5000} unitAmount={5000} totalLabel="" />
      </View>
      <View style={styles.stateItem}>
        <Text style={styles.stateLabel}>Mostly UNIT</Text>
        <ProgressBar ecashAmount={2000} unitAmount={8000} totalLabel="" />
      </View>
      <View style={styles.stateItem}>
        <Text style={styles.stateLabel}>All eCash</Text>
        <ProgressBar ecashAmount={10000} unitAmount={0} totalLabel="" />
      </View>
      <View style={styles.stateItem}>
        <Text style={styles.stateLabel}>All UNIT</Text>
        <ProgressBar ecashAmount={0} unitAmount={10000} totalLabel="" />
      </View>
    </View>

    <Text style={styles.sectionLabel}>BREAKDOWN CARDS</Text>
    <View style={styles.cardGrid}>
      <BreakdownCard
        icon="turbo"
        label="TurboUNIT (eCash)"
        amount="7,500.00"
        color={COLORS.TEAL}
        percent={61}
      />
      <BreakdownCard
        icon="unit_logo"
        label="UNIT (On-chain)"
        amount="4,845.67"
        color={COLORS.PRIMARY_BLUE}
        percent={39}
      />
    </View>

    <Text style={styles.sectionLabel}>LEGEND</Text>
    <View style={styles.legendCard}>
      <View style={styles.fullLegend}>
        <View style={styles.fullLegendItem}>
          <View style={[styles.legendSquare, { backgroundColor: COLORS.TEAL }]} />
          <View style={styles.fullLegendContent}>
            <Text style={styles.fullLegendTitle}>eCash (TurboUNIT)</Text>
            <Text style={styles.fullLegendDesc}>
              Instant, off-chain UNIT tokens. Fast transfers with no on-chain fees.
            </Text>
          </View>
        </View>
        <View style={styles.fullLegendItem}>
          <View style={[styles.legendSquare, { backgroundColor: COLORS.PRIMARY_BLUE }]} />
          <View style={styles.fullLegendContent}>
            <Text style={styles.fullLegendTitle}>UNIT (On-chain)</Text>
            <Text style={styles.fullLegendDesc}>
              Standard UNIT tokens on the blockchain. Secure and verifiable.
            </Text>
          </View>
        </View>
      </View>
    </View>
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof ProgressStory> = {
  title: 'Components/Progress',
  component: ProgressStory,
};

export default meta;
type Story = StoryObj<typeof ProgressStory>;

export const ECashVsUNIT: Story = {};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },

  // Progress bar
  progressWrapper: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  progressTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  progressTrack: {
    height: 12,
    backgroundColor: COLORS.BORDER_COLOR,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  ecashFill: {
    backgroundColor: COLORS.TEAL,
  },
  unitFill: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.WHITE,
  },

  // States
  statesGrid: {
    gap: 12,
  },
  stateItem: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 12,
  },
  stateLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 8,
  },

  // Circular (simplified - not SVG based)
  circularWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularOuter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  circularSegment: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 10,
  },
  ecashSegment: {},
  circularInner: {
    alignItems: 'center',
  },
  circularLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  circularValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.WHITE,
  },

  // Breakdown cards
  cardGrid: {
    gap: 12,
  },
  breakdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  breakdownIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownContent: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 2,
  },
  breakdownAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  breakdownPercent: {
    alignItems: 'flex-end',
  },
  percentValue: {
    fontSize: 20,
    fontWeight: '700',
  },

  // Full legend
  legendCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
  },
  fullLegend: {
    gap: 16,
  },
  fullLegendItem: {
    flexDirection: 'row',
    gap: 12,
  },
  legendSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  fullLegendContent: {
    flex: 1,
  },
  fullLegendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 2,
  },
  fullLegendDesc: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 18,
  },
});
