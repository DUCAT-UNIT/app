import { useMemo } from 'react';
import { COLORS } from '../theme';
import { getRunesAmount } from '../utils/runesHelper';
import type { RuneBalance } from '../services/balanceService';
import type { VaultData } from '../services/vaultService';

interface UseWalletCalculationsParams {
  segwitBalance?: number;
  taprootBalance?: number;
  runesBalance?: RuneBalance[];
  cashuBalance?: number | null;
  btcPrice?: number | null;
  vaultData?: VaultData | null;
}

interface UseWalletCalculationsReturn {
  totalBalanceBTC: number;
  totalBalanceUSD: number;
  vaultCollateralRatio: number;
  vaultHealthPercentage: number;
  vaultHealthColor: string;
  vaultDebt: number;
  vaultCollateral: number;
  hasVault: boolean;
  unitValueInBTC: number;
}

/**
 * Custom hook for wallet-related calculations
 * Extracts business logic from WalletScreen component
 */

export const useWalletCalculations = ({
  segwitBalance = 0,
  taprootBalance: _taprootBalance = 0,
  runesBalance = [],
  cashuBalance = 0,
  btcPrice: btcPriceParam = 0,
  vaultData = null,
}: UseWalletCalculationsParams): UseWalletCalculationsReturn => {
  // Ensure btcPrice is never null (default params don't handle null, only undefined)
  const btcPrice = btcPriceParam ?? 0;
  /**
   * Calculate total balance in BTC
   * Includes: BTC balance + UNIT value in BTC + Cashu ecash value in BTC + DUCAT value in BTC
   */
  const totalBalanceBTC = useMemo(() => {
    const btcValue = segwitBalance || 0;
    const unitValue = getRunesAmount(runesBalance) / (btcPrice || 1);
    const cashuValue = (cashuBalance || 0) / (btcPrice || 1);
    const ducatValue = 0; // DUCAT value in BTC (currently 0)

    return btcValue + unitValue + cashuValue + ducatValue;
  }, [segwitBalance, runesBalance, cashuBalance, btcPrice]);

  /**
   * Calculate total balance in USD
   * Includes: BTC USD value + UNIT USD value + Cashu ecash USD value + DUCAT USD value
   */
  const totalBalanceUSD = useMemo(() => {
    const btcUsdValue = (segwitBalance || 0) * (btcPrice || 0);
    const unitUsdValue = getRunesAmount(runesBalance);
    const cashuUsdValue = cashuBalance || 0;
    const ducatUsdValue = 0; // DUCAT value in USD (currently 0)

    return btcUsdValue + unitUsdValue + cashuUsdValue + ducatUsdValue;
  }, [segwitBalance, runesBalance, cashuBalance, btcPrice]);

  /**
   * Calculate vault collateral ratio
   * Formula: (collateralValue / debt) * 100
   */
  const vaultCollateralRatio = useMemo(() => {
    if (!vaultData) {
      return 0;
    }

    // Use totalDebt from vault list API (already in UNIT, not cents)
    const debt = vaultData.totalDebt || 0;

    // Use latest BTC price from wallet context, fallback to oracle price from vault data
    const priceToUse = btcPrice || vaultData.currentPrice || 0;
    const collateralValue = (vaultData.totalCollateral || 0) * priceToUse;

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
    if (!vaultData) {
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
    if (!vaultData) {
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

    return getRunesAmount(runesBalance) / btcPrice;
  }, [runesBalance, btcPrice]);

  /**
   * Get formatted vault debt
   * Returns the amount borrowed from vault
   */
  const vaultDebt = useMemo(() => {
    if (!vaultData || !vaultData.totalDebt) {
      return 0;
    }

    // totalDebt from API is already in UNIT (not cents)
    return vaultData.totalDebt;
  }, [vaultData]);

  /**
   * Get formatted vault collateral
   * Returns the vault amount in BTC
   */
  const vaultCollateral = useMemo(() => {
    if (!vaultData || !vaultData.totalCollateral) {
      return 0;
    }

    // totalCollateral from API is already in BTC (not sats)
    return vaultData.totalCollateral;
  }, [vaultData]);

  /**
   * Check if vault exists
   * Vault exists if we have vaultData with debt or collateral
   */
  const hasVault = useMemo(() => {
    return !!(vaultData && (vaultData.totalDebt || vaultData.totalCollateral));
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
