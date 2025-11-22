/**
 * EcashThresholdSheet Component
 * Bottom sheet for selecting ecash auto-conversion threshold
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../theme';
import Icon from '../icons';
import BottomSheet from '../common/BottomSheet';

export default function EcashThresholdSheet({ visible, onClose, onSelectThreshold, currentThreshold }) {
  const thresholdOptions = [
    { value: 100, label: '100' },
    { value: 500, label: '500' },
    { value: 1000, label: '1000' },
    { value: Infinity, label: 'All transfers' },
  ];

  const handleSelect = (value) => {
    onSelectThreshold(value);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ecash Default">
      <Text style={styles.description}>
        Transactions below this threshold will automatically use ecash for faster, private payments.
      </Text>

      <View style={styles.optionsContainer}>
        {thresholdOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              currentThreshold === option.value && styles.optionSelected,
            ]}
            onPress={() => handleSelect(option.value)}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              {option.value !== Infinity && (
                <Icon name="unit_logo" size={24} color={COLORS.WHITE} />
              )}
              <Text style={styles.optionLabel}>{option.label}</Text>
            </View>
            {currentThreshold === option.value && (
              <Icon name="check" size={20} color={COLORS.PRIMARY_BLUE} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

EcashThresholdSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectThreshold: PropTypes.func.isRequired,
  currentThreshold: PropTypes.number.isRequired,
};

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    paddingHorizontal: 20,
    marginBottom: 24,
    lineHeight: 20,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: COLORS.PRIMARY_BLUE,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
