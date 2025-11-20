/**
 * UnitBalanceBreakdown Component
 * Displays breakdown of UNIT balance between E-UNIT (e-cash) and UNIT (runes)
 * with a visual progress bar
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

const UnitBalanceBreakdown = ({ ecashBalance, runesBalance }) => {
  const totalBalance = ecashBalance + runesBalance;
  const ecashPercentage = totalBalance > 0 ? (ecashBalance / totalBalance) * 100 : 50;
  const runesPercentage = totalBalance > 0 ? (runesBalance / totalBalance) * 100 : 50;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBarEcash,
            { width: `${ecashPercentage}%` }
          ]}
        />
        <View
          style={[
            styles.progressBarRunes,
            { width: `${runesPercentage}%` }
          ]}
        />
      </View>

      {/* Balance Labels */}
      <View style={styles.labelsContainer}>
        {/* E-UNIT (E-cash) */}
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
          <Text style={styles.balanceLabel}>in wallet</Text>
        </View>

        {/* UNIT (Runes) */}
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
          <Text style={styles.balanceLabel}>balance remaining</Text>
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
  },
  progressBarEcash: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  progressBarRunes: {
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
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
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  dotRunes: {
    backgroundColor: COLORS.MEDIUM_GRAY,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.WHITE,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginLeft: 10, // Align with text (5px dot + 5px margin)
  },
});

export default UnitBalanceBreakdown;
