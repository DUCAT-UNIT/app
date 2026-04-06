import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../styles/theme';
import type { LiquidationReviewTab } from '../../stores/liquidationFlowStore';
import LiquidationReviewOverview from './LiquidationReviewOverview';
import LiquidationReviewHowItWorks from './LiquidationReviewHowItWorks';

export interface LiquidationReviewScreenProps {
  investAmount: number;
  profitRate: number;
  depositRate: number;
  swapRate: number;
  btcPrice: number;
  showBTC: boolean;
  reviewTab: LiquidationReviewTab;
  onTabChange: (tab: LiquidationReviewTab) => void;
}

const LiquidationReviewScreen = React.memo(function LiquidationReviewScreen({
  investAmount,
  profitRate,
  depositRate,
  swapRate,
  btcPrice,
  showBTC,
  reviewTab,
  onTabChange,
}: LiquidationReviewScreenProps): React.ReactElement {
  return (
    <>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, reviewTab === 'overview' && styles.tabActive]}
          onPress={() => onTabChange('overview')}
        >
          <Text style={[styles.tabText, reviewTab === 'overview' && styles.tabTextActive]}>
            {'\u26A1'} Quick Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, reviewTab === 'howItWorks' && styles.tabActive]}
          onPress={() => onTabChange('howItWorks')}
        >
          <Text style={[styles.tabText, reviewTab === 'howItWorks' && styles.tabTextActive]}>
            {'\u24D8'} How it works
          </Text>
        </TouchableOpacity>
      </View>

      {reviewTab === 'overview' ? (
        <LiquidationReviewOverview
          investAmount={investAmount}
          profitRate={profitRate}
          depositRate={depositRate}
          swapRate={swapRate}
          btcPrice={btcPrice}
          showBTC={showBTC}
        />
      ) : (
        <LiquidationReviewHowItWorks
          investAmount={investAmount}
          profitRate={profitRate}
          swapRate={swapRate}
          btcPrice={btcPrice}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.bg.secondary,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  tabText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
  },
});

export default LiquidationReviewScreen;
