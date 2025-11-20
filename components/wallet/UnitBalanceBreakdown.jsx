/**
 * UnitBalanceBreakdown Component
 * Displays breakdown of UNIT balance between E-UNIT (e-cash) and UNIT (runes)
 * with a visual progress bar
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../theme';

const UnitBalanceBreakdown = ({ ecashBalance, runesBalance, onInfoPress }) => {
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
              })} E-UNIT
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

        {/* Info Icon */}
        {onInfoPress && (
          <TouchableOpacity onPress={onInfoPress} style={styles.infoButton}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>i</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

UnitBalanceBreakdown.propTypes = {
  ecashBalance: PropTypes.number.isRequired,
  runesBalance: PropTypes.number.isRequired,
  onInfoPress: PropTypes.func,
};

UnitBalanceBreakdown.defaultProps = {
  ecashBalance: 0,
  runesBalance: 0,
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 24,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: COLORS.DARK_GRAY,
    marginBottom: 16,
  },
  progressBarEcash: {
    backgroundColor: '#5B8FF9', // Blue for e-cash
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  progressBarRunes: {
    backgroundColor: COLORS.MEDIUM_GRAY, // Gray for runes
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelSection: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotEcash: {
    backgroundColor: '#5B8FF9', // Blue dot
  },
  dotRunes: {
    backgroundColor: COLORS.MEDIUM_GRAY, // Gray dot
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.WHITE,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginLeft: 18, // Align with text (10px dot + 8px margin)
  },
  infoButton: {
    marginLeft: 12,
  },
  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.SECONDARY_TEXT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
});

export default UnitBalanceBreakdown;
