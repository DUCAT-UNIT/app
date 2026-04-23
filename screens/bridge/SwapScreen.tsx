import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/icons';
import { isEvmBridgeConfigured } from '../../constants/evm';
import {
  getCrossChainSwapLimit,
  quoteUnitUsdcSwap,
  type CrossChainSwapAsset,
  type CrossChainSwapQuote,
} from '../../services/evmBridgeService';
import { COLORS } from '../../theme';

interface SwapScreenProps {
  route?: {
    params?: {
      sourceAsset?: CrossChainSwapAsset;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
  };
}

function formatUsd(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '$0';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatTokenAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(numeric);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function trimEditableAmount(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export default function SwapScreen({ route, navigation }: SwapScreenProps): React.JSX.Element {
  const bridgeReady = isEvmBridgeConfigured();
  const routeSourceAsset = route?.params?.sourceAsset === 'USDC' ? 'USDC' : 'UNIT';

  const [sourceAsset, setSourceAsset] = useState<CrossChainSwapAsset>(routeSourceAsset);
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState<CrossChainSwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [maxInputAmount, setMaxInputAmount] = useState<string | null>(null);
  const [didClampToMax, setDidClampToMax] = useState(false);

  const destinationAsset: CrossChainSwapAsset = sourceAsset === 'UNIT' ? 'USDC' : 'UNIT';
  const validAmount = Number(amountIn) > 0;
  const numericAmountIn = Number(amountIn);
  const numericAmountOut = Number(quote?.amountOut || '0');
  const quoteRatio =
    quote && validAmount && Number.isFinite(numericAmountOut) && numericAmountIn > 0
      ? numericAmountOut / numericAmountIn
      : null;
  const pegLossPercent =
    quoteRatio !== null && Number.isFinite(quoteRatio) ? Math.max(0, (1 - quoteRatio) * 100) : 0;
  const showLiquidityWarning = Boolean(quote && !quoting && quoteRatio !== null && quoteRatio < 0.98);
  const blockOversizedTrade = Boolean(quote && !quoting && quoteRatio !== null && quoteRatio < 0.75);

  useEffect(() => {
    setSourceAsset(routeSourceAsset);
  }, [routeSourceAsset]);

  useEffect(() => {
    if (!bridgeReady) {
      setMaxInputAmount(null);
      return undefined;
    }

    let active = true;
    getCrossChainSwapLimit()
      .then((limit) => {
        if (active) {
          setMaxInputAmount(limit.maxInputAmount);
        }
      })
      .catch(() => {
        if (active) {
          setMaxInputAmount(null);
        }
      });

    return () => {
      active = false;
    };
  }, [bridgeReady, sourceAsset]);

  useEffect(() => {
    if (!maxInputAmount || !amountIn) {
      return;
    }

    if (Number(amountIn) > Number(maxInputAmount)) {
      setAmountIn(trimEditableAmount(maxInputAmount));
      setDidClampToMax(true);
    }
  }, [amountIn, maxInputAmount]);

  useEffect(() => {
    if (!bridgeReady || !validAmount) {
      setQuote(null);
      setQuoting(false);
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(() => {
      setQuoting(true);
      quoteUnitUsdcSwap(sourceAsset, amountIn)
        .then((nextQuote) => {
          if (active) {
            setQuote(nextQuote);
          }
        })
        .catch(() => {
          if (active) {
            setQuote(null);
          }
        })
        .finally(() => {
          if (active) {
            setQuoting(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [amountIn, bridgeReady, sourceAsset, validAmount]);

  const handleFlipAssets = (): void => {
    setSourceAsset((current) => (current === 'UNIT' ? 'USDC' : 'UNIT'));
    setQuote(null);
    setDidClampToMax(false);
  };

  const handleAmountChange = (nextValue: string): void => {
    const sanitized = nextValue.replace(/[^0-9.]/g, '');
    if (sanitized.split('.').length > 2) {
      return;
    }

    if (!maxInputAmount) {
      setAmountIn(sanitized);
      setDidClampToMax(false);
      return;
    }

    const numericNextValue = Number(sanitized);
    const numericMaxInput = Number(maxInputAmount);

    if (sanitized && Number.isFinite(numericNextValue) && Number.isFinite(numericMaxInput) && numericNextValue > numericMaxInput) {
      setAmountIn(trimEditableAmount(maxInputAmount));
      setDidClampToMax(true);
      return;
    }

    setAmountIn(sanitized);
    setDidClampToMax(false);
  };

  const handleContinue = (): void => {
    if (!bridgeReady || !validAmount || !quote) {
      return;
    }

    navigation.navigate('SepoliaSwapSummary', {
      sourceAsset,
      amountIn,
    });
  };

  const outputAmount = quoting ? '...' : formatTokenAmount(quote?.amountOut || '0');
  const outputUsd = quoting ? '...' : formatUsd(quote?.amountOut || '0');
  const quoteWarningTitle = blockOversizedTrade ? 'Pool too shallow for this size' : 'Quote is off peg';
  const quoteWarningBody =
    validAmount && quote
      ? `${formatTokenAmount(amountIn)} ${sourceAsset} is currently estimated to return ${outputAmount} ${destinationAsset}. ${
          blockOversizedTrade
            ? 'Reduce the size before continuing.'
            : `That is ${formatPercent(pegLossPercent)} below 1:1 because Sepolia liquidity is limited.`
        }`
      : '';
  const maxClampBody =
    maxInputAmount
      ? `Amount capped to the current max of ${formatTokenAmount(maxInputAmount)} ${sourceAsset}.`
      : 'Amount capped to the current pool max.';

  return (
    <SafeAreaView style={styles.safeArea} testID="cross-chain-swap-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={navigation.goBack} testID="cross-chain-swap-back-btn">
          <Icon name="back" size={20} color={COLORS.WHITE} />
        </TouchableOpacity>

        {!bridgeReady && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>Swap unavailable</Text>
          </View>
        )}

        <View style={styles.sellCard}>
          <Text style={styles.cardModeLabel}>Sell</Text>
          <View style={styles.cardRow}>
            <View style={styles.valueColumn}>
              <TextInput
                value={amountIn}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.MEDIUM_GRAY}
                testID="cross-chain-swap-amount-input"
              />
              <Text style={styles.fiatText}>{formatUsd(amountIn)}</Text>
            </View>

            <View style={styles.assetSelector}>
              <Icon
                name={sourceAsset === 'UNIT' ? 'unit_logo' : 'usdc_logo'}
                size={42}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.flipButton}
          onPress={handleFlipAssets}
          testID="cross-chain-swap-flip-btn"
        >
          <Icon name="receive" size={24} color={COLORS.WHITE} />
        </TouchableOpacity>

        <View style={styles.buyCard}>
          <Text style={styles.cardModeLabel}>Buy</Text>
          <View style={styles.cardRow}>
            <View style={styles.valueColumn}>
              <Text style={styles.outputAmount}>{outputAmount}</Text>
              <Text style={styles.fiatText}>{outputUsd}</Text>
            </View>

            <View style={styles.assetSelector}>
              <Icon
                name={destinationAsset === 'UNIT' ? 'unit_logo' : 'usdc_logo'}
                size={42}
              />
            </View>
          </View>
        </View>

        {didClampToMax && (
          <View style={styles.quoteWarningCard}>
            <Text style={styles.quoteWarningTitle}>Max size reached</Text>
            <Text style={styles.quoteWarningBody}>{maxClampBody}</Text>
          </View>
        )}

        {showLiquidityWarning && (
          <View style={styles.quoteWarningCard}>
            <Text style={styles.quoteWarningTitle}>{quoteWarningTitle}</Text>
            <Text style={styles.quoteWarningBody}>{quoteWarningBody}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!bridgeReady || !validAmount || quoting || !quote || blockOversizedTrade) && styles.primaryButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!bridgeReady || !validAmount || quoting || !quote || blockOversizedTrade}
          testID="cross-chain-swap-submit-btn"
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  warningCard: {
    marginBottom: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2A1C22',
  },
  warningText: {
    color: '#FF8BD9',
    fontWeight: '600',
  },
  sellCard: {
    minHeight: 138,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#171617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  buyCard: {
    minHeight: 138,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    backgroundColor: '#262425',
    marginTop: -4,
  },
  cardModeLabel: {
    color: COLORS.LIGHT_MEDIUM_GRAY,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  valueColumn: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  amountInput: {
    color: COLORS.WHITE,
    fontSize: 42,
    fontWeight: '400',
    paddingHorizontal: 0,
    paddingVertical: 0,
    lineHeight: 46,
  },
  outputAmount: {
    color: COLORS.WHITE,
    fontSize: 42,
    fontWeight: '400',
    lineHeight: 46,
  },
  fiatText: {
    color: COLORS.LIGHT_MEDIUM_GRAY,
    fontSize: 14,
    marginTop: 4,
  },
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  quoteWarningCard: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.24)',
  },
  quoteWarningTitle: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  quoteWarningBody: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 18,
  },
  flipButton: {
    alignSelf: 'center',
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1F1E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    marginBottom: -18,
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.DARK_BG,
    fontSize: 16,
    fontWeight: '700',
  },
});
