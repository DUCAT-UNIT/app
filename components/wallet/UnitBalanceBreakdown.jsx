/**
 * UnitBalanceBreakdown Component
 * Displays breakdown of UNIT balance between E-UNIT (e-cash) and UNIT (runes)
 * with a visual progress bar
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
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
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Pattern
                id="diagonalStripes"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <Rect width="4" height="8" fill={COLORS.PRIMARY_BLUE} />
                <Rect x="4" width="4" height="8" fill={COLORS.MEDIUM_GRAY} />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#diagonalStripes)" />
          </Svg>
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
    position: 'relative',
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
