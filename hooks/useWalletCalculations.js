import { useMemo } from 'react';
import { COLORS } from '../utils/colors';

/**
 * Custom hook for wallet-related calculations
 * Extracts business logic from WalletScreen component
 *
 * @param {Object} params
 * @param {number} params.segwitBalance - BTC balance in BTC (not sats)
 * @param {number} params.taprootBalance - BTC balance in taproot address
 * @param {Array} params.runesBalance - Array of runes balances
 * @param {number} params.btcPrice - Current BTC price in USD
 * @param {Object} params.vaultData - Vault data from context
 * @returns {Object} Calculated values for display
 */
export const useWalletCalculations = ({
  segwitBalance = 0,
  _taprootBalance = 0,
  runesBalance = [],
  btcPrice = 0,
  vaultData = null,
}) => {
  /**
   * Calculate total balance in BTC
   * Includes: BTC balance + UNIT value in BTC + DUCAT value in BTC
   */
  const totalBalanceBTC = useMemo(() => {
    const btcValue = segwitBalance || 0;
    const unitValue =
      runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) / (btcPrice || 1) : 0;
    const ducatValue = 0; // DUCAT value in BTC (currently 0)

    return btcValue + unitValue + ducatValue;
  }, [segwitBalance, runesBalance, btcPrice]);

  /**
   * Calculate total balance in USD
   * Includes: BTC USD value + UNIT USD value + DUCAT USD value
   */
  const totalBalanceUSD = useMemo(() => {
    const btcUsdValue = (segwitBalance || 0) * (btcPrice || 0);
    const unitUsdValue = runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
    const ducatUsdValue = 0; // DUCAT value in USD (currently 0)

    return btcUsdValue + unitUsdValue + ducatUsdValue;
  }, [segwitBalance, runesBalance, btcPrice]);

  /**
   * Calculate vault collateral ratio
   * Formula: (collateralValue / debt) * 100
   */
  const vaultCollateralRatio = useMemo(() => {
    if (!vaultData || !vaultData.latestTransaction) {
      return 0;
    }

    const debt = vaultData.latestTransaction.amountBorrowed / 100;
    const collateralValue =
      vaultData.totalCollateral * (btcPrice || vaultData.latestTransaction.oraclePrice);

    if (debt === 0) {
      return 0;
    }

    return (collateralValue / debt) * 100;
  }, [vaultData, btcPrice]);

  /**
   * Calculate vault health percentage
   * Returns the collateral ratio as a percentage (e.g., 250 for 250%)
   */
  const vaultHealthPercentage = useMemo(() => {
    if (!vaultData || !vaultData.latestTransaction) {
      return 0;
    }

    return Math.floor(vaultCollateralRatio);
  }, [vaultData, vaultCollateralRatio]);

  /**
   * Calculate vault health color based on collateral ratio
   * Green: >= 200% (safe)
   * Yellow: >= 161% (warning)
   * Red: < 161% (danger)
   * Gray: No vault data
   */
  const vaultHealthColor = useMemo(() => {
    if (!vaultData || !vaultData.latestTransaction) {
      return COLORS.SECONDARY_TEXT; // Gray
    }

    if (vaultCollateralRatio >= 200) {
      return COLORS.GREEN;
    }

    if (vaultCollateralRatio >= 161) {
      return COLORS.YELLOW;
    }

    return COLORS.RED;
  }, [vaultData, vaultCollateralRatio]);

  /**
   * Calculate UNIT value in BTC
   * Used for displaying UNIT balance in BTC equivalent
   */
  const unitValueInBTC = useMemo(() => {
    if (runesBalance.length === 0 || !btcPrice) {
      return 0;
    }

    return parseFloat(runesBalance[0][1]) / btcPrice;
  }, [runesBalance, btcPrice]);

  /**
   * Get formatted vault debt
   * Returns the amount borrowed from vault
   */
  const vaultDebt = useMemo(() => {
    if (!vaultData || !vaultData.latestTransaction || !vaultData.latestTransaction.amountBorrowed) {
      return 0;
    }

    return vaultData.latestTransaction.amountBorrowed / 100;
  }, [vaultData]);

  /**
   * Get formatted vault collateral
   * Returns the vault amount in BTC
   */
  const vaultCollateral = useMemo(() => {
    if (!vaultData || !vaultData.latestTransaction || !vaultData.latestTransaction.vaultAmount) {
      return 0;
    }

    return vaultData.latestTransaction.vaultAmount / 100000000;
  }, [vaultData]);

  /**
   * Check if vault exists
   */
  const hasVault = useMemo(() => {
    return !!(vaultData && vaultData.latestTransaction);
  }, [vaultData]);

  return {
    // Total balance calculations
    totalBalanceBTC,
    totalBalanceUSD,

    // Vault health calculations
    vaultCollateralRatio,
    vaultHealthPercentage,
    vaultHealthColor,

    // Vault details
    vaultDebt,
    vaultCollateral,
    hasVault,

    // Asset conversions
    unitValueInBTC,
  };
};
