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
        {/* Onchain indicator (blue) */}
        <View
          style={[
            styles.progressBarIndicator,
            { width: `${runesPercentage}%` }
          ]}
        />
      </View>

      {/* Balance Labels */}
      <View style={styles.labelsContainer}>
        {/* UNIT (Runes) - left aligned */}
        <View style={styles.labelSectionLeft}>
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

        {/* E-UNIT (E-cash) - right aligned position, left aligned text */}
        <View style={styles.labelSectionRight}>
          <View style={styles.labelRow}>
            <View style={[styles.dot, styles.dotEcash]} />
            <Text style={styles.balanceValue}>
              {ecashBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} eUNIT
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
    paddingTop: 0,
    paddingBottom: 12,
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.MEDIUM_GRAY,
    marginBottom: 12,
    width: '61%',
    maxWidth: 309,
    position: 'relative',
  },
  progressBarIndicator: {
    height: 8,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 8,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '61%',
    maxWidth: 309,
  },
  labelSectionLeft: {
    alignItems: 'flex-start',
  },
  labelSectionRight: {
    alignItems: 'flex-start',
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
