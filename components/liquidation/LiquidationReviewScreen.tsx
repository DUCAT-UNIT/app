import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../styles/theme';
import type { LiquidationReviewTab } from '../../stores/liquidationFlowStore';
import LiquidationReviewOverview from './LiquidationReviewOverview';
import LiquidationReviewHowItWorks from './LiquidationReviewHowItWorks';

export interface LiquidationReviewScreenProps {
  claimBtc: number;
  swapBtc: number;
  swapUnit: number;
  profitBtc: number;
  profitPercent: number;
  totalBtc: number;
  returnBtc: number;
  btcPrice: number;
  showBTC: boolean;
  reviewTab: LiquidationReviewTab;
  onTabChange: (tab: LiquidationReviewTab) => void;
}

const LiquidationReviewScreen = React.memo(function LiquidationReviewScreen({
  claimBtc,
  swapBtc,
  swapUnit,
  profitBtc,
  profitPercent,
  totalBtc,
  returnBtc,
  btcPrice,
  showBTC,
  reviewTab,
  onTabChange,
}: LiquidationReviewScreenProps): React.ReactElement {
  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, reviewTab === 'overview' && styles.tabActive]}
          onPress={() => onTabChange('overview')}
        >
          <Text style={[styles.tabText, reviewTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, reviewTab === 'howItWorks' && styles.tabActive]}
          onPress={() => onTabChange('howItWorks')}
        >
          <Text style={[styles.tabText, reviewTab === 'howItWorks' && styles.tabTextActive]}>
            Details
          </Text>
        </TouchableOpacity>
      </View>

      {reviewTab === 'overview' ? (
        <LiquidationReviewOverview
          claimBtc={claimBtc}
          swapBtc={swapBtc}
          swapUnit={swapUnit}
          profitBtc={profitBtc}
          profitPercent={profitPercent}
          totalBtc={totalBtc}
          returnBtc={returnBtc}
          btcPrice={btcPrice}
          showBTC={showBTC}
        />
      ) : (
        <LiquidationReviewHowItWorks
          returnBtc={returnBtc}
          swapUnit={swapUnit}
          profitBtc={profitBtc}
          profitPercent={profitPercent}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.bg.secondary,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: colors.bg.tertiary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
  },
});

export default LiquidationReviewScreen;
