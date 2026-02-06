/**
 * AmountSection Component
 * Amount slider with fee selector for BTC or UNIT
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AmountSlider } from '../../../components/vaultAction/AmountSlider';
import { UnitAmountSlider } from '../../../components/vaultAction/UnitAmountSlider';
import { FeeRateDropdown } from '../../../components/common/FeeRateSelectorCompact';
import { spacing } from '../../../styles/theme';

interface AmountSectionProps {
  /** Whether sending BTC (vs UNIT) */
  isBtc: boolean;
  /** Current amount value */
  value: number;
  /** Maximum sendable amount */
  maxValue: number;
  /** Called when amount changes (on release) */
  onValueChange: (value: number) => void;
  /** Called during slider drag */
  onLiveValueChange: (value: number) => void;
  /** Current BTC price (for BTC display) */
  btcPrice?: number;
  /** Selected fee rate */
  selectedFeeRate: number;
  /** Called when fee rate changes */
  onFeeRateChange: (rate: number) => void;
  /** Estimated fee in satoshis */
  estimatedFeeSats: number;
}

export function AmountSection({
  isBtc,
  value,
  maxValue,
  onValueChange,
  onLiveValueChange,
  btcPrice,
  selectedFeeRate,
  onFeeRateChange,
  estimatedFeeSats,
}: AmountSectionProps): React.JSX.Element {
  const renderFooter = () => (
    <FeeRateDropdown
      selectedRate={selectedFeeRate}
      onRateChange={onFeeRateChange}
      estimatedFeeSats={estimatedFeeSats}
      transparent
    />
  );

  return (
    <View style={styles.section}>
      {isBtc ? (
        <AmountSlider
          value={value}
          maxValue={maxValue}
          onValueChange={onValueChange}
          onLiveValueChange={onLiveValueChange}
          label="Amount to Send"
          btcPrice={btcPrice}
          disabled={maxValue <= 0}
          renderFooter={renderFooter}
        />
      ) : (
        <UnitAmountSlider
          value={value}
          maxValue={maxValue}
          onValueChange={onValueChange}
          onLiveValueChange={onLiveValueChange}
          label="Amount to Send"
          disabled={maxValue <= 0}
          renderFooter={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
  },
});
