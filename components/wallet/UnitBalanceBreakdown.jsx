/**
 * UnitBalanceBreakdown Component
 * Displays breakdown of UNIT balance between E-UNIT (e-cash) and UNIT (runes)
 * with a visual progress bar
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../theme';

const UnitBalanceBreakdown = ({ ecashBalance, runesBalance }) => {
  const totalBalance = ecashBalance + runesBalance;
  const ecashPercentage = totalBalance > 0 ? (ecashBalance / totalBalance) * 100 : 50;
  const runesPercentage = totalBalance > 0 ? (runesBalance / totalBalance) * 100 : 50;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        {/* Onchain solid blue on left */}
        <View
          style={[
            styles.progressBarRunes,
            { width: `${runesPercentage}%` }
          ]}
        />
        {/* E-cash with striped pattern on right */}
        <View
          style={[
            styles.progressBarEcash,
            { width: `${ecashPercentage}%` }
          ]}
        >
          <LinearGradient
            colors={[
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE,
              COLORS.MEDIUM_GRAY, COLORS.MEDIUM_GRAY,
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE,
              COLORS.MEDIUM_GRAY, COLORS.MEDIUM_GRAY,
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE,
              COLORS.MEDIUM_GRAY, COLORS.MEDIUM_GRAY,
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE,
              COLORS.MEDIUM_GRAY, COLORS.MEDIUM_GRAY,
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE,
              COLORS.MEDIUM_GRAY, COLORS.MEDIUM_GRAY,
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE,
              COLORS.MEDIUM_GRAY, COLORS.MEDIUM_GRAY,
              COLORS.PRIMARY_BLUE, COLORS.PRIMARY_BLUE
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.70 }}
            locations={[
              0.00, 0.08,
              0.08, 0.16,
              0.16, 0.24,
              0.24, 0.32,
              0.32, 0.40,
              0.40, 0.48,
              0.48, 0.56,
              0.56, 0.64,
              0.64, 0.72,
              0.72, 0.80,
              0.80, 0.88,
              0.88, 0.96,
              0.96, 1.00
            ]}
            style={styles.progressBarGradient}
          />
        </View>
      </View>

      {/* Balance Labels */}
      <View style={styles.labelsContainer}>
        {/* UNIT (Runes) - now on left */}
        <View style={styles.labelSection}>
          <View style={styles.labelRow}>
            <View style={[styles.dot, styles.dotRunes]} />
            <Text style={styles.balanceValue}>
              {runesBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} UNIT
            </Text>
          </View>
          <Text style={styles.balanceLabel}>onchain</Text>
        </View>

        {/* E-UNIT (E-cash) - now on right */}
        <View style={styles.labelSection}>
          <View style={styles.labelRow}>
            <View style={[styles.dot, styles.dotEcash]} />
            <Text style={styles.balanceValue}>
              {ecashBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} UNIT
            </Text>
          </View>
          <Text style={styles.balanceLabel}>ecash</Text>
        </View>
      </View>
    </View>
  );
};

UnitBalanceBreakdown.propTypes = {
  ecashBalance: PropTypes.number.isRequired,
  runesBalance: PropTypes.number.isRequired,
};

UnitBalanceBreakdown.defaultProps = {
  ecashBalance: 0,
  runesBalance: 0,
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 24,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: COLORS.DARK_GRAY,
    marginBottom: 12,
    width: '47%',
    maxWidth: 238,
    clipPath: 'inset(0)',
  },
  progressBarEcash: {
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    height: 8,
  },
  progressBarGradient: {
    flex: 1,
    height: 8,
  },
  progressBarRunes: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '47%',
    maxWidth: 238,
  },
  labelSection: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  dotEcash: {
    backgroundColor: COLORS.MEDIUM_GRAY,
  },
  dotRunes: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  balanceValue: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.WHITE,
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginLeft: 10, // Align with text (5px dot + 5px margin)
  },
});

export default UnitBalanceBreakdown;
