import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../icons';
import { AmountSlider } from '../vaultAction/AmountSlider';
import ErrorBoundary from '../ErrorBoundary';
import {
  fetchLiquidatableVaults,
  formatValidatorResponse,
} from '../../services/liquidation/fetchVaults';
import {
  computeLiqMeta,
  getMaxInvest,
  getAvailableCollateralBtc,
  selectItemsForAmount,
} from '../../services/liquidation/calculations';
import {
  LIQ_MAX_CLAIM_AMOUNT_BTC,
  LIQ_DEFAULT_FEE_RATE,
} from '../../services/liquidation/constants';
import type {
  LiqVaultDisplay,
  LiquidVaultProfileWithMeta,
} from '../../services/liquidation/types';
import { executeLiquidation } from '../../services/liquidation/execution';
import { fetchProtocolContract } from '../../services/vaultWallet';
import { VaultAPI } from '@ducat-unit/client-sdk';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { usePendingVaultTransactionStore } from '../../stores/pendingVaultTransactionStore';
import { useResponsive } from '../../hooks/useResponsive';
import { logger } from '../../utils/logger';
import { formatFiat } from '../../utils/formatters';
import type { WalletAddresses } from '../../contexts/WalletContext';
import type { VaultData } from '../../services/vaultService';

/**
 * Props for LiquidationScreen
 */
export interface LiquidationScreenProps {
  btcPrice: number | null;
  segwitBalance: number;
  taprootBalance: number;
  vaultCollateral: number;
  vaultDebt: number;
  hasVault: boolean;
  wallet: WalletAddresses | null;
  vaultData: VaultData | null;
  visible: boolean;
  onClose: () => void;
  onToggle: () => void;
}

const LiquidationScreen = React.memo(function LiquidationScreen({
  btcPrice,
  segwitBalance,
  taprootBalance,
  vaultCollateral,
  vaultDebt,
  hasVault,
  wallet,
  vaultData,
  visible,
  onClose,
}: LiquidationScreenProps): React.ReactElement | null {
  const { s } = useResponsive();

  // Liquidation screen state
  const [liquidationsShowBTC, setLiquidationsShowBTC] = useState(false);
  const [liqInvestAmount, setLiqInvestAmount] = useState(0);
  const [liqVaultExpanded, setLiqVaultExpanded] = useState(false);
  const [liqStep, setLiqStep] = useState<'input' | 'review' | 'processing' | 'success' | 'error'>('input');
  const [liqReviewTab, setLiqReviewTab] = useState<'overview' | 'howItWorks'>('overview');
  const [liqProcessingMsg, setLiqProcessingMsg] = useState('Preparing liquidation...');
  const [liqResultTxid, setLiqResultTxid] = useState<string | null>(null);
  const [liqError, setLiqError] = useState<string | null>(null);

  // Liquidation: use refs to avoid render loops in React.memo
  const liqVaultsRef = useRef<LiqVaultDisplay[]>([]);
  const liqVaultsFullRef = useRef<LiquidVaultProfileWithMeta[]>([]);
  const [liqVaultsLoaded, setLiqVaultsLoaded] = useState(0);
  const liqProfitRateRef = useRef(0.15);
  const liqDepositRateRef = useRef(0.32);
  const liqSwapRateRef = useRef(0.68);

  const liqPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liqFetchInFlightRef = useRef(false);

  const maxInvestable = React.useMemo(() => {
    if (!btcPrice || liqVaultsFullRef.current.length === 0) return 0;
    // segwitBalance and taprootBalance are in BTC, convert to sats for getMaxInvest
    const walletSats = Math.round(((segwitBalance || 0) + (taprootBalance || 0)) * 100_000_000);
    // Available collateral limits how much debt the vault can absorb
    // while staying above MIN_COL_RATE (160%). Same as web frontend.
    const availableCollateral = hasVault
      ? getAvailableCollateralBtc(btcPrice, vaultCollateral || 0, vaultDebt || 0)
      : walletSats / 100_000_000; // No vault: wallet BTC is the constraint
    const stats = getMaxInvest(
      true, // isAutoSwap — always swap UNIT for the user
      availableCollateral,
      walletSats,
      btcPrice,
      LIQ_DEFAULT_FEE_RATE,
      liqVaultsFullRef.current,
      LIQ_MAX_CLAIM_AMOUNT_BTC,
    );
    logger.debug('[Liquidation] maxInvest calc', {
      walletSats,
      availableCollateral: availableCollateral === Infinity ? 'Infinity' : availableCollateral,
      hasVault,
      vaultCount: liqVaultsFullRef.current.length,
      result: stats.maxInvestBtc,
      maxClaim: stats.maxClaimAmountBtc,
      maxSwap: stats.maxSwapBtc,
    });
    return stats.maxInvestBtc;
  }, [btcPrice, segwitBalance, taprootBalance, vaultCollateral, vaultDebt, hasVault, liqVaultsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extracted vault fetch logic — reusable by toggle + polling
  const refreshLiqVaults = useCallback(async () => {
    if (!btcPrice || liqFetchInFlightRef.current) return;
    liqFetchInFlightRef.current = true;
    try {
      const [raw, contract] = await Promise.all([
        fetchLiquidatableVaults(),
        fetchProtocolContract(),
      ]);
      const currentPrice = btcPrice || 67000;
      logger.debug('[Liquidation] Fetch result', { rawCount: raw.length, price: currentPrice });
      const extended = formatValidatorResponse(raw);

      const fullProfiles: LiquidVaultProfileWithMeta[] = [];
      const displayProfiles: LiqVaultDisplay[] = [];

      for (const v of extended) {
        try {
          const sdkVault = v as unknown as Parameters<typeof VaultAPI.repo.liquidation.get_profile>[1];
          const profile = VaultAPI.repo.liquidation.get_profile(
            contract, sdkVault, v.thold_key, currentPrice,
          );
          const meta = computeLiqMeta(profile);
          const unitSwapBtc = v.unit / currentPrice;

          if (meta.profitBtc > 0 && meta.claimAmountBtc > 0) {
            fullProfiles.push({
              ...v,
              ...profile,
              ...meta,
              unitSwapBtc,
            } as LiquidVaultProfileWithMeta);
            displayProfiles.push({
              vaultId: v.vaultId,
              unit: v.unit,
              btcInVault: v.btcInVault,
              claimAmountBtc: meta.claimAmountBtc,
              profitBtc: meta.profitBtc,
              profitPercent: meta.profitPercent,
              postTaxBtcInVault: meta.postTaxBtcInVault,
              unitSwapBtc,
            });
          }
        } catch (sdkErr: unknown) {
          logger.debug('[Liquidation] SDK profile failed for vault', {
            vaultId: v.vaultId,
            error: sdkErr instanceof Error ? sdkErr.message : String(sdkErr),
          });
        }
      }

      // Sort by profit descending
      const indices = displayProfiles.map((_, i) => i);
      indices.sort((a, b) => displayProfiles[b].profitPercent - displayProfiles[a].profitPercent);
      const sortedDisplay = indices.map(i => displayProfiles[i]);
      const sortedFull = indices.map(i => fullProfiles[i]);

      // Compute real ratios from first vault
      if (sortedDisplay.length > 0) {
        const first = sortedDisplay[0];
        liqProfitRateRef.current = first.profitPercent / 100;
        const totalRequired = first.claimAmountBtc + first.unitSwapBtc;
        if (totalRequired > 0) {
          liqDepositRateRef.current = first.claimAmountBtc / totalRequired;
          liqSwapRateRef.current = first.unitSwapBtc / totalRequired;
        }
      }

      liqVaultsRef.current = sortedDisplay;
      liqVaultsFullRef.current = sortedFull;
      logger.debug('[Liquidation] Vaults ready', {
        display: sortedDisplay.length,
        full: sortedFull.length,
        filtered: extended.length - sortedDisplay.length,
      });
      setLiqVaultsLoaded(prev => prev + 1);
    } catch (fetchErr: unknown) {
      logger.warn('[Liquidation] Fetch failed', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      setLiqVaultsLoaded(prev => prev + 1);
    } finally {
      liqFetchInFlightRef.current = false;
    }
  }, [btcPrice]);

  // Poll liquidatable vaults every 30s while on input screen
  useEffect(() => {
    if (visible && liqStep === 'input') {
      liqPollingRef.current = setInterval(() => {
        void refreshLiqVaults();
      }, 30_000);
      logger.debug('[Liquidation] Polling started (30s interval)');
    }
    return () => {
      if (liqPollingRef.current) {
        clearInterval(liqPollingRef.current);
        liqPollingRef.current = null;
        logger.debug('[Liquidation] Polling stopped');
      }
    };
  }, [visible, liqStep, refreshLiqVaults]);

  // Initial fetch when becoming visible
  useEffect(() => {
    if (visible) {
      void refreshLiqVaults();
    }
  }, [visible, refreshLiqVaults]);

  if (!visible) return null;

  return (
    <ErrorBoundary
      boundaryName="Liquidations"
      fallbackMessage="Unable to load liquidations. Please try again."
      onReset={() => { onClose(); }}
    >
      <View style={styles.liquidationsHeader}>
        <Text style={styles.liquidationsTitle}>Liquidations</Text>
        <TouchableOpacity
          style={styles.currencyToggle}
          onPress={() => setLiquidationsShowBTC(!liquidationsShowBTC)}
          accessibilityRole="switch"
          accessibilityLabel={liquidationsShowBTC ? 'Show in USD' : 'Show in BTC'}
        >
          <View style={[
            styles.currencyToggleTrack,
            liquidationsShowBTC && styles.currencyToggleTrackActive,
          ]}>
            <View style={[
              styles.currencyToggleThumb,
              liquidationsShowBTC && styles.currencyToggleThumbActive,
            ]}>
              <Text style={styles.currencyToggleActiveText}>
                {liquidationsShowBTC ? '\u20BF' : '$'}
              </Text>
            </View>
            <Text style={[
              styles.currencyToggleLabel,
              liquidationsShowBTC ? styles.currencyToggleLabelLeft : styles.currencyToggleLabelRight,
            ]}>
              {liquidationsShowBTC ? '$' : '\u20BF'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      {(liqStep === 'processing' || liqStep === 'success' || liqStep === 'error') ? (
        <View style={styles.liqStatusScreen}>
          {liqStep === 'processing' && (
            <>
              <View style={styles.liqStatusIcon}>
                <Icon name="liquidations" size={s(48)} color={colors.brand.primary} />
              </View>
              <Text style={styles.liqStatusTitle}>Processing Liquidation</Text>
              <Text style={styles.liqStatusSub}>{liqProcessingMsg}</Text>
            </>
          )}
          {liqStep === 'success' && (
            <>
              <View style={[styles.liqStatusIcon, { backgroundColor: '#1a3a2a' }]}>
                <Text style={{ fontSize: 32 }}>{'\u2713'}</Text>
              </View>
              <Text style={styles.liqStatusTitle}>Liquidation Claimed</Text>
              <Text style={styles.liqStatusSub}>
                Your vault has been updated with the liquidated collateral and debt.
              </Text>
              {liqResultTxid && (
                <Text style={[styles.liqStatusSub, { fontSize: 11, marginTop: 8 }]}>
                  TX: {liqResultTxid.substring(0, 16)}...
                </Text>
              )}
            </>
          )}
          {liqStep === 'error' && (
            <>
              <View style={[styles.liqStatusIcon, { backgroundColor: '#3a1a1a' }]}>
                <Text style={{ fontSize: 32 }}>{'\u2715'}</Text>
              </View>
              <Text style={styles.liqStatusTitle}>Liquidation Failed</Text>
              <Text style={styles.liqStatusSub}>{liqError || 'An error occurred'}</Text>
            </>
          )}
        </View>
      ) : liqStep === 'review' ? (() => {
        // Compute review values from investment amount
        const price = btcPrice ?? 0;
        const profitRate = liqProfitRateRef.current;
        const depositRate = liqDepositRateRef.current;
        const swapRate = liqSwapRateRef.current;
        const liqProfitBtc = liqInvestAmount * profitRate;
        const liqDepositBtc = liqInvestAmount * depositRate;
        const liqSwapBtc = liqInvestAmount * swapRate;
        const liqReturnBtc = liqInvestAmount + liqProfitBtc;
        const liqCollateralBtc = liqDepositBtc + liqProfitBtc; // deposit + profit = collateral received
        const liqSwapUnit = liqSwapBtc * price;
        const fmt = (v: number, d = 8) => v.toFixed(d);

        return (<>
          {/* Tab Bar */}
          <View style={styles.liqTabBar}>
            <TouchableOpacity
              style={[styles.liqTab, liqReviewTab === 'overview' && styles.liqTabActive]}
              onPress={() => setLiqReviewTab('overview')}
            >
              <Text style={[styles.liqTabText, liqReviewTab === 'overview' && styles.liqTabTextActive]}>
                {'\u26A1'} Quick Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.liqTab, liqReviewTab === 'howItWorks' && styles.liqTabActive]}
              onPress={() => setLiqReviewTab('howItWorks')}
            >
              <Text style={[styles.liqTabText, liqReviewTab === 'howItWorks' && styles.liqTabTextActive]}>
                {'\u24D8'} How it works
              </Text>
            </TouchableOpacity>
          </View>

          {liqReviewTab === 'overview' ? (
            <ScrollView style={styles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(120) }} showsVerticalScrollIndicator={false}>
              {/* Profit (upper) + Breakdown (lower) — two-tone card */}
              <View style={[styles.liqVaultOuter, { marginTop: 0 }]}>
                {/* Upper: Profit */}
                <View style={styles.liqReviewUpper}>
                  <View style={styles.liqReviewProfitHeader}>
                    <Text style={styles.liqReviewProfitTitle}>Total profit</Text>
                    <View style={styles.liqReviewProfitBadge}>
                      <Text style={styles.liqReviewProfitBadgeText}>+{Math.round(profitRate * 100)}%</Text>
                    </View>
                  </View>
                  <Text style={styles.liqReviewProfitAmount}>
                    {liquidationsShowBTC
                      ? `+${fmt(liqProfitBtc)} BTC`
                      : `+$${(liqProfitBtc * price).toFixed(2)}`}
                  </Text>
                  <Text style={styles.liqReviewProfitSub}>
                    {liquidationsShowBTC
                      ? `$ ${(liqProfitBtc * price).toFixed(2)}`
                      : `\u20BF ${fmt(liqProfitBtc)}`}
                  </Text>
                </View>

                {/* Lower: Breakdown */}
                <View style={styles.liqReviewLower}>
                  <View style={styles.liqReviewRow}>
                    <Text style={styles.liqReviewRowLabel}>Your deposit</Text>
                    <View>
                      <Text style={styles.liqReviewRowValue}>{fmt(liqDepositBtc)} BTC</Text>
                      <Text style={styles.liqReviewRowSub}>$ {(liqDepositBtc * price).toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.liqReviewDivider} />
                  <View style={styles.liqReviewRow}>
                    <Text style={[styles.liqReviewRowLabel, { color: colors.brand.primary }]}>You swap to UNIT</Text>
                    <View>
                      <Text style={styles.liqReviewRowValue}>{fmt(liqSwapBtc)} BTC</Text>
                      <Text style={styles.liqReviewRowSub}>$ {liqSwapUnit.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.liqReviewDivider} />
                  <View style={styles.liqReviewRow}>
                    <View>
                      <Text style={styles.liqReviewRowLabel}>Total BTC required</Text>
                      <Text style={[styles.liqReviewRowSub, { textAlign: 'left' }]}>from your vault</Text>
                    </View>
                    <View>
                      <Text style={[styles.liqReviewRowValue, { fontFamily: fonts.bold }]}>{liqInvestAmount.toFixed(8)} BTC</Text>
                      <Text style={styles.liqReviewRowSub}>$ {(liqInvestAmount * (btcPrice ?? 0)).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* You get in your vault */}
              <View style={styles.liqReviewCard}>
                <View style={styles.liqReviewGetHeader}>
                  <Icon name="vault_logo" size={s(20)} color={colors.text.secondary} />
                  <Text style={styles.liqReviewGetTitle}>You get in your vault</Text>
                </View>
                <View style={styles.liqReviewGetGrid}>
                  <View style={styles.liqReviewGetBox}>
                    <Text style={styles.liqReviewGetBoxValue}>{fmt(liqReturnBtc, 6)} BTC</Text>
                    <Text style={styles.liqReviewGetBoxSub}>{fmt(liqCollateralBtc, 6)} collateral</Text>
                    <Text style={styles.liqReviewGetBoxSub}>{fmt(liqDepositBtc, 6)} deposit</Text>
                  </View>
                  <Text style={styles.liqReviewGetPlus}>+</Text>
                  <View style={[styles.liqReviewGetBox, { borderColor: colors.brand.primary }]}>
                    <Text style={styles.liqReviewGetBoxValue}>{liqSwapUnit.toFixed(2)} UNIT</Text>
                    <Text style={styles.liqReviewGetBoxSub}>repayable debt</Text>
                  </View>
                </View>
              </View>

              {/* You get in your wallet */}
              <View style={styles.liqReviewCard}>
                <View style={styles.liqReviewGetHeader}>
                  <Icon name="wallet" size={s(20)} color={colors.text.secondary} />
                  <Text style={styles.liqReviewGetTitle}>You get in your wallet</Text>
                </View>
                <View style={[styles.liqReviewGetBox, { borderColor: colors.brand.primary, alignSelf: 'center', width: '60%' }]}>
                  <Text style={styles.liqReviewGetBoxValue}>{liqSwapUnit.toFixed(2)} UNIT</Text>
                  <Text style={styles.liqReviewGetBoxSub}>to pay the vault debt</Text>
                </View>
              </View>
            </ScrollView>
          ) : (
            /* How it works tab */
            <ScrollView style={styles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(120) }} showsVerticalScrollIndicator={false}>
              {/* Description */}
              <View style={styles.liqReviewCard}>
                <Text style={styles.liqHowDesc}>
                  You deposit BTC to restore an unhealthy vault to health. In return, you receive the liquidated vault's collateral and debt to your vault, including a{' '}
                  <Text style={{ color: '#59AA8A', fontFamily: fonts.bold }}>{Math.round(liqProfitRateRef.current * 100)}% profit</Text>
                  {' '}for taking on the liquidation.
                </Text>
              </View>

              {/* What happens next */}
              <View style={styles.liqReviewCard}>
                <Text style={styles.liqHowSectionTitle}>What happens next?</Text>
                {[
                  { num: '1', title: 'Your vault gets updated', desc: `Added to your vault: ${fmt(liqReturnBtc, 6)} BTC + ${liqSwapUnit.toFixed(2)} UNIT debt.`, auto: true },
                  { num: '2', title: 'Receive UNIT in wallet', desc: `You receive ${liqSwapUnit.toFixed(2)} UNIT in your wallet to repay the debt.`, auto: true },
                  { num: '3', title: 'Repay your vault debt', desc: `Use the ${liqSwapUnit.toFixed(2)} UNIT in your wallet to clear the debt in your vault.`, auto: false },
                  { num: '4', title: 'Withdraw your profit', desc: `After clearing the debt, withdraw your ${fmt(liqReturnBtc, 6)} BTC (includes the ${fmt(liqProfitBtc, 6)} BTC profit).`, auto: false },
                ].map((step) => (
                  <View key={step.num} style={styles.liqHowStep}>
                    <View style={styles.liqHowStepNum}>
                      <Text style={styles.liqHowStepNumText}>{step.num}</Text>
                    </View>
                    <View style={styles.liqHowStepContent}>
                      <Text style={styles.liqHowStepTitle}>{step.title}</Text>
                      <Text style={styles.liqHowStepDesc}>{step.desc}</Text>
                    </View>
                    <Text style={[styles.liqHowStepBadge, step.auto ? { color: '#59AA8A' } : { color: colors.text.secondary }]}>
                      {step.auto ? 'Automatic \u26A1' : 'Manual\n(Optional)'}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </>);
      })() : (liqVaultsLoaded > 0 && liqVaultsRef.current.length === 0) ? (
        /* Empty state: No vaults to liquidate */
        <View style={styles.liqStatusScreen}>
          <View style={[styles.liqStatusIcon, { backgroundColor: '#1D1C21' }]}>
            <Icon name="liquidations" size={s(48)} color={colors.text.secondary} />
          </View>
          <Text style={styles.liqStatusTitle}>No Current Liquidations</Text>
          <Text style={styles.liqStatusSub}>
            There are no vaults in the liquidation pool at this time. All vaults are maintaining healthy collateral ratios.
          </Text>
        </View>
      ) : (liqVaultsLoaded > 0 && maxInvestable <= 0) ? (
        /* Empty state: Collateral too low */
        <View style={styles.liqStatusScreen}>
          <View style={[styles.liqStatusIcon, { backgroundColor: '#2A1A1A' }]}>
            <Icon name="vault" size={s(48)} color="#D04C68" />
          </View>
          <Text style={styles.liqStatusTitle}>Vault Collateral Too Low</Text>
          <Text style={styles.liqStatusSub}>
            Your vault doesn't have enough available collateral to absorb liquidated debt. Deposit more BTC or repay some debt to free up capacity.
          </Text>
        </View>
      ) : !liqVaultsLoaded ? (
        /* Loading state */
        <View style={styles.liqStatusScreen}>
          <View style={[styles.liqStatusIcon, { backgroundColor: '#1D1C21' }]}>
            <Icon name="liquidations" size={s(48)} color={colors.text.secondary} />
          </View>
          <Text style={styles.liqStatusTitle}>Loading Vaults...</Text>
          <Text style={styles.liqStatusSub}>
            Fetching liquidatable vaults from the network.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(80) }} showsVerticalScrollIndicator={false}>
          {/* Investment Amount - uses existing AmountSlider component */}
          <AmountSlider
            value={liqInvestAmount}
            maxValue={maxInvestable}
            onValueChange={setLiqInvestAmount}
            onLiveValueChange={setLiqInvestAmount}
            label="Amount to Invest"
            btcPrice={btcPrice ?? undefined}
            attachedBottom
            renderFooter={() => {
              const profitBtc = liqInvestAmount * liqProfitRateRef.current;
              const returnBtc = liqInvestAmount + profitBtc;
              const price = btcPrice ?? 0;
              return (
                <View style={styles.liqFooter}>
                  <View style={styles.liqInfoRow}>
                    <Text style={styles.liqInfoLabel}>You invest</Text>
                    <Text style={styles.liqInfoValue}>
                      {liquidationsShowBTC ? `${liqInvestAmount.toFixed(8)} BTC` : `$${(liqInvestAmount * price).toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={styles.liqInfoRow}>
                    <Text style={styles.liqInfoLabel}>You get back</Text>
                    <Text style={styles.liqInfoValue}>
                      {liquidationsShowBTC ? `${returnBtc.toFixed(8)} BTC` : `$${(returnBtc * price).toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={[styles.liqInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.liqProfitLabel}>Total profit</Text>
                    <Text style={styles.liqProfitValue}>
                      {liquidationsShowBTC ? `+${profitBtc.toFixed(8)} BTC` : `+$${(profitBtc * price).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Vault Selector — upper card + lower table */}
          <View style={styles.liqVaultOuter}>
            {/* Upper: Vaults label */}
            <TouchableOpacity
              style={styles.liqVaultUpper}
              onPress={() => setLiqVaultExpanded(!liqVaultExpanded)}
              activeOpacity={1}
              testID="liq-vault-selector"
            >
              <View style={styles.liqVaultLeft}>
                <Icon name="vault_logo" size={s(18)} color={colors.text.secondary} />
                <Text style={styles.liqVaultName}>
                  {liqInvestAmount > 0 ? (() => {
                    let count = 0;
                    let rem = liqInvestAmount;
                    for (const v of liqVaultsRef.current) {
                      if (rem <= 0) break;
                      count++;
                      rem -= v.claimAmountBtc;
                    }
                    return `${count} Vault${count !== 1 ? 's' : ''} Selected`;
                  })() : 'Vaults'}
                </Text>
              </View>
              <Text style={styles.liqVaultChevron}>{liqVaultExpanded ? '\u25B2' : '\u25BC'}</Text>
            </TouchableOpacity>

            {/* Lower: Table */}
            {liqVaultExpanded && (
              <View style={styles.liqVaultLower}>
                <View style={styles.liqVaultTableHeader}>
                  <View style={styles.liqVaultRowCheck} />
                  <Text style={styles.liqVaultColHeader}>Debt</Text>
                  <Text style={styles.liqVaultColHeader}>Collateral</Text>
                  <Text style={styles.liqVaultColHeader}>Claim</Text>
                </View>
                {(() => {
                  // Compute which vaults are selected based on invest amount
                  if (liqInvestAmount <= 0 || liqVaultsRef.current.length === 0) {
                    return (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: colors.text.secondary, fontSize: fontSizes.sm }}>
                          {!liqVaultsLoaded ? 'Loading vaults...' :
                            liqVaultsRef.current.length === 0 ? 'No liquidatable vaults available' :
                              'Adjust slider to select vaults'}
                        </Text>
                      </View>
                    );
                  }

                  // Select vaults greedily until invest amount is met
                  const selected: { vault: LiqVaultDisplay; isPartial: boolean }[] = [];
                  let remaining = liqInvestAmount;
                  for (const vault of liqVaultsRef.current) {
                    if (remaining <= 0) break;
                    if (remaining >= vault.claimAmountBtc) {
                      selected.push({ vault, isPartial: false });
                      remaining -= vault.claimAmountBtc;
                    } else {
                      selected.push({ vault, isPartial: true });
                      remaining = 0;
                    }
                  }

                  return selected.map(({ vault, isPartial }, i) => (
                    <TouchableOpacity
                      key={vault.vaultId || `vault-${i}`}
                      style={[styles.liqVaultRow, i === selected.length - 1 && { borderBottomWidth: 0, paddingBottom: 16 }]}
                      onPress={() => setLiqVaultExpanded(false)}
                    >
                      <View style={styles.liqVaultRowCheck}>
                        {isPartial ? (
                          <View style={{ width: 14, height: 16, position: 'relative' }}>
                            {/* Gray base checkmark */}
                            <Text style={{ color: '#555', fontSize: 14, position: 'absolute', left: 0, top: 0 }}>{'\u2713'}</Text>
                            {/* Green left half overlay */}
                            <View style={{ position: 'absolute', left: 0, top: 0, width: 7, height: 16, overflow: 'hidden' }}>
                              <Text style={{ color: '#59AA8A', fontSize: 14 }}>{'\u2713'}</Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={{ color: '#59AA8A', fontSize: 14 }}>{'\u2713'}</Text>
                        )}
                      </View>
                      <View style={styles.liqVaultRowValue}>
                        <Icon name="unit_symbol" size={10} color={colors.text.secondary} />
                        <Text style={styles.liqVaultRowText}>{formatFiat(vault.unit, 2)}</Text>
                      </View>
                      <View style={styles.liqVaultRowValue}>
                        <Icon name="btc_symbol" size={10} color={colors.text.secondary} />
                        <Text style={styles.liqVaultRowText}>{vault.btcInVault.toFixed(6)}</Text>
                      </View>
                      <Text style={[styles.liqVaultRowText, { flex: 1, textAlign: 'center' }]}>
                        {liquidationsShowBTC
                          ? `${vault.claimAmountBtc.toFixed(6)} \u20BF`
                          : `$${formatFiat(vault.claimAmountBtc * (btcPrice ?? 0), 2)}`}
                      </Text>
                    </TouchableOpacity>
                  ));
                })()}
              </View>
            )}

          </View>

        </ScrollView>
      )}

      {/* Bottom Button — fixed */}
      <View style={styles.liqContinueWrap}>
        <TouchableOpacity
          style={[styles.liqContinueBtn, liqStep === 'input' && liqInvestAmount <= 0 && { opacity: 0.5 }]}
          onPress={async () => {
            if (liqStep === 'input') {
              setLiqStep('review');
            } else if (liqStep === 'review') {
              setLiqStep('processing');
              setLiqProcessingMsg('Connecting to oracle...');
              try {
                // Select vaults using the same algorithm as the web frontend
                // Supports partial claims on the last vault
                const claimed = selectItemsForAmount(liqVaultsFullRef.current, liqInvestAmount);
                if (claimed.length === 0) {
                  setLiqError('Investment amount too small to claim any vault.');
                  setLiqStep('error');
                  return;
                }

                // Separate full and partial vaults (matches web prepareRepossessData)
                const claimedFull = claimed.filter(v => !v.claimAmountPartial);
                const claimedPartial = claimed.find(v => !!v.claimAmountPartial);

                // Re-compute partial vault profile with repo_portion
                let selectedVaults: LiquidVaultProfileWithMeta[];
                if (claimedPartial) {
                  const portion = Number((claimedPartial.claimAmountPartial! / claimedPartial.claimAmountBtc).toFixed(4));
                  try {
                    const contract = await fetchProtocolContract();
                    const partialProfile = VaultAPI.repo.liquidation.get_profile(
                      contract,
                      claimedPartial as Parameters<typeof VaultAPI.repo.liquidation.get_profile>[1],
                      claimedPartial.thold_key,
                      btcPrice || 0,
                      portion,
                    );
                    const partialMeta = computeLiqMeta(partialProfile);
                    const recomputedPartial = {
                      ...claimedPartial,
                      ...partialProfile,
                      ...partialMeta,
                    } as LiquidVaultProfileWithMeta;
                    // Partial vault goes FIRST (same as web: line 172-179)
                    selectedVaults = [recomputedPartial, ...claimedFull];
                  } catch {
                    // Fallback: use full vaults only
                    selectedVaults = claimedFull;
                  }
                } else {
                  selectedVaults = claimedFull;
                }

                // Compute deficit from selected vaults
                const deficitBtc = selectedVaults.reduce(
                  (acc, v) => acc + (v.claimAmountPartial || v.claimAmountBtc), 0,
                );

                const result = await executeLiquidation({
                  liquidVaults: selectedVaults,
                  walletInfo: {
                    segwitAddress: wallet?.segwitAddress || '',
                    segwitPubkey: wallet?.segwitPubkey || '',
                    taprootAddress: wallet?.taprootAddress || '',
                    taprootPubkey: wallet?.taprootPubkey || '',
                  },
                  vaultPubkey: wallet?.taprootPubkey || '',
                  btcInVault: vaultCollateral || 0,
                  unitDebt: vaultDebt || 0,
                  feeRate: LIQ_DEFAULT_FEE_RATE,
                  deficitAmountBtc: deficitBtc,
                  vaultInfo: {
                    creation_account: vaultData?.vaultInfo?.creation_account || '',
                    guard_pubkey: vaultData?.vaultInfo?.guard_pubkey || '',
                    master_id: vaultData?.vaultInfo?.master_id || '',
                  },
                  onProgress: setLiqProcessingMsg,
                });
                if (result.success) {
                  setLiqResultTxid(result.txid || null);
                  setLiqStep('success');
                  // Add as pending vault transaction
                  if (result.txid) {
                    void usePendingVaultTransactionStore.getState().setPendingTransaction({
                      txid: result.txid,
                      vaultTxid: result.vaultTxid,
                      action: 'repo' as const,
                      btcAmt: Math.round(deficitBtc * 100_000_000),
                      unitAmt: Math.round(selectedVaults.reduce((acc, v) => acc + v.unit, 0) * 100),
                      timestamp: Date.now(),
                      vaultPubkey: wallet?.taprootPubkey || '',
                    });
                  }
                } else {
                  setLiqError(result.error || 'Liquidation failed');
                  setLiqStep('error');
                }
              } catch (err: unknown) {
                setLiqError(err instanceof Error ? err.message : 'Liquidation failed');
                setLiqStep('error');
              }
            } else if (liqStep === 'success') {
              // Close liquidation screen and return to wallet
              setLiqError(null);
              setLiqResultTxid(null);
              setLiqInvestAmount(0);
              onClose();
            } else if (liqStep === 'error') {
              setLiqStep('input');
              setLiqError(null);
              setLiqResultTxid(null);
            }
          }}
          testID="liquidation-continue-btn"
          disabled={(liqStep === 'input' && liqInvestAmount <= 0) || liqStep === 'processing'}
        >
          <Text style={styles.liqContinueBtnText}>
            {liqStep === 'processing' ? 'Processing...' :
              liqStep === 'success' ? 'Done' :
                liqStep === 'error' ? 'Try Again' :
                  liqStep === 'review' ? 'Claim Liquidation' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  liquidationsHeader: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liquidationsTitle: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  currencyToggle: {
    padding: 4,
  },
  currencyToggleTrack: {
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  currencyToggleTrackActive: {
    flexDirection: 'row-reverse',
  },
  currencyToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyToggleThumbActive: {
    backgroundColor: '#F7931A',
  },
  currencyToggleActiveText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  currencyToggleLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
    position: 'absolute',
  },
  currencyToggleLabelLeft: {
    left: 10,
  },
  currencyToggleLabelRight: {
    right: 10,
  },
  liquidationsBody: {
    flex: 1,
    paddingHorizontal: 16,
  },
  liqVaultOuter: {
    marginTop: 12,
    marginBottom: 16,
  },
  liqVaultUpper: {
    backgroundColor: '#1D1C21',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28272C',
    zIndex: 2,
    elevation: 3,
  },
  liqVaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liqVaultName: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqVaultChevron: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  liqVaultLower: {
    backgroundColor: '#28272C',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
    paddingTop: 24,
    paddingBottom: 4,
    zIndex: 1,
  },
  liqVaultTableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2E',
  },
  liqVaultColHeader: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  liqVaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  liqVaultRowCheck: {
    width: 20,
    alignItems: 'center',
  },
  liqVaultRowValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  liqVaultRowText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqFooter: {
    paddingTop: 8,
  },
  liqInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2E',
  },
  liqInfoLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  liqInfoValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqProfitLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: '#59AA8A',
  },
  liqProfitValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: '#59AA8A',
  },
  liqReviewCard: {
    backgroundColor: '#1D1C21',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28272C',
    padding: 14,
    marginBottom: 8,
    marginTop: 0,
  },
  liqReviewProfitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liqReviewProfitTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqReviewProfitBadge: {
    backgroundColor: '#59AA8A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liqReviewProfitBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  liqReviewProfitAmount: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: '#59AA8A',
    textAlign: 'center',
    marginBottom: 2,
  },
  liqReviewProfitSub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  liqTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1D1C21',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#28272C',
    alignItems: 'stretch',
  },
  liqTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  liqTabActive: {
    backgroundColor: '#28272C',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  liqTabText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  liqTabTextActive: {
    color: colors.text.primary,
  },
  liqHowDesc: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  liqHowSectionTitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  liqHowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28272C',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  liqHowStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1D1C21',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  liqHowStepNumText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  liqHowStepContent: {
    flex: 1,
  },
  liqHowStepTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  liqHowStepDesc: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: 2,
    marginRight: 50,
  },
  liqHowStepBadge: {
    fontSize: 10,
    fontFamily: fonts.medium,
    textAlign: 'right',
    width: 65,
  },
  liqReviewUpper: {
    backgroundColor: '#1D1C21',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28272C',
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 2,
    elevation: 3,
  },
  liqReviewLower: {
    backgroundColor: '#28272C',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 12,
    zIndex: 1,
  },
  liqReviewDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 10,
  },
  liqReviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liqReviewRowLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  liqReviewRowValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    textAlign: 'right',
  },
  liqReviewRowSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 2,
  },
  liqReviewGetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  liqReviewGetTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqReviewGetGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liqReviewGetBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#28272C',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  liqReviewGetPlus: {
    color: colors.text.secondary,
    fontSize: 18,
    marginHorizontal: 6,
  },
  liqReviewGetBoxValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  liqReviewGetBoxSub: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  liqStatusScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  liqStatusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1D1C21',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  liqStatusTitle: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  liqStatusSub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  liqContinueWrap: {
    position: 'absolute',
    bottom: 38,
    left: 80,
    right: 16,
    zIndex: 100,
  },
  liqContinueBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  liqContinueBtnText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
});

export default LiquidationScreen;
