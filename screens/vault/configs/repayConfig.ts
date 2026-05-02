/**
 * Repay Operation Configuration
 */

import { computeHealthFactor, computeLiquidationPrice, getHealthColorFromValue as getHealthColor } from '../../../utils/vaultUtils';
import { formatVaultUsd } from '../../../utils/vaultFaceValue';
import { colors } from '../../../styles/theme';
import type {
  RepayVaultStore,
  VaultInputScreenConfig,
  VaultConfirmScreenConfig,
  VaultProcessingScreenConfig,
  VaultPreview,
  ValidationResult,
  EmptyStateConfig,
  SummaryRow,
} from '../types';

export const repayRoutes = {
  input: 'RepayInput',
  confirm: 'RepayConfirm',
  processing: 'RepayProcessing',
  success: 'RepaySuccess',
};

export const repayInputConfig: VaultInputScreenConfig<
  RepayVaultStore,
  { repayBalanceUsd?: number; directUnitBalanceUsd?: number }
> = {
  operationType: 'repay',
  title: 'Repay USD',
  asset: 'USD',
  routes: repayRoutes,
  checksMinHealth: false,
  changesActionType: 'debt',

  getAmountConfig: (store) => ({
    value: store.repayAmountUsd,
    setValue: store.setRepayAmountUsd,
    maxValue: Math.max(0, Math.floor(store.maxRepayableUsd || 0)),
    label: 'USD to Repay',
    isUnitAmount: true,
    displayUnitLabel: 'USD',
    hideAvailable: true,
  }),

  computePreview: (
    amount: number,
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    bitcoinPrice: number | null
  ): VaultPreview => {
    const newDebt = Math.max(0, effectiveUnitBorrowed - amount);

    if (!bitcoinPrice || effectiveBtcLocked <= 0) {
      return {
        newCollateral: effectiveBtcLocked,
        newDebt,
        newHealth: 0,
        newLiqPrice: 0,
      };
    }

    // If fully repaid, max health
    if (newDebt <= 0) {
      return {
        newCollateral: effectiveBtcLocked,
        newDebt: 0,
        newHealth: 999,
        newLiqPrice: Infinity,
      };
    }

    return {
      newCollateral: effectiveBtcLocked,
      newDebt,
      newHealth: computeHealthFactor(effectiveBtcLocked, bitcoinPrice, newDebt),
      newLiqPrice: computeLiquidationPrice(newDebt, effectiveBtcLocked),
    };
  },

  validate: (
    amount: number,
    _maxAmount: number,
    _effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    _preview: VaultPreview,
    hasSufficientBtcForFees: boolean,
    additionalData?: { repayBalanceUsd?: number; directUnitBalanceUsd?: number; allowUsdc?: boolean }
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const allowUsdc = additionalData?.allowUsdc ?? true;
    const repayBalanceUsd = additionalData?.repayBalanceUsd ?? 0;
    const directUnitBalanceUsd = additionalData?.directUnitBalanceUsd ?? 0;
    const maxFundingUsd = allowUsdc
      ? Math.max(repayBalanceUsd, directUnitBalanceUsd)
      : directUnitBalanceUsd;

    // Check repay exceeds debt
    if (amount > effectiveUnitBorrowed) {
      errors.push(`Cannot repay more than your debt (${formatVaultUsd(effectiveUnitBorrowed)}).`);
    }

    // Check repay exceeds available funding path
    if (amount > maxFundingUsd) {
      if (!allowUsdc) {
        errors.push(`Insufficient spendable UNIT balance. You have ${formatVaultUsd(directUnitBalanceUsd)} available.`);
      } else if (directUnitBalanceUsd > 0) {
        errors.push(
          `Insufficient repayable balance. You have ${formatVaultUsd(directUnitBalanceUsd)} in spendable UNIT or ${formatVaultUsd(repayBalanceUsd)} in Sepolia USDC.`,
        );
      } else {
        errors.push(`Insufficient Sepolia USDC balance. You have ${formatVaultUsd(repayBalanceUsd)} available.`);
      }
    }

    // Check fee balance
    if (!hasSufficientBtcForFees) {
      errors.push('Insufficient BTC for transaction fees.');
    }

    return {
      canContinue: amount > 0 && amount <= effectiveUnitBorrowed && amount <= maxFundingUsd && hasSufficientBtcForFees,
      warnings,
      errors,
    };
  },

  getEmptyState: (
    _effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    additionalData?: { repayBalanceUsd?: number; directUnitBalanceUsd?: number; allowUsdc?: boolean }
  ): EmptyStateConfig | null => {
    const allowUsdc = additionalData?.allowUsdc ?? true;
    // No debt
    if (effectiveUnitBorrowed <= 0) {
      return {
        icon: 'checkmark-circle-outline',
        iconColor: colors.semantic.success,
        title: 'No debt to repay',
      };
    }

    // No repayable balance
    if (
      additionalData?.repayBalanceUsd !== undefined
      && (allowUsdc ? additionalData.repayBalanceUsd <= 0 : true)
      && (additionalData?.directUnitBalanceUsd ?? 0) <= 0
    ) {
      return {
        icon: 'alert-circle-outline',
        iconColor: colors.semantic.warning,
        title: 'No Repayable Balance',
        subtitle: allowUsdc
          ? `You need either spendable UNIT or Sepolia USDC to repay your debt of ${formatVaultUsd(effectiveUnitBorrowed)}.`
          : `You need spendable UNIT to repay your debt of ${formatVaultUsd(effectiveUnitBorrowed)}.`,
      };
    }

    return null;
  },
};

export function createRepayConfirmConfig(allowUsdc = true): VaultConfirmScreenConfig<RepayVaultStore> {
  return {
  operationType: 'repay',
  title: 'Confirm Repay',
  authMessage: 'Authenticate to repay USD',
  routes: repayRoutes,

  getPrimaryAmount: (store) => ({
    amount: store.repayAmountUsd,
    unit: 'USD',
  }),

  executeOperation: async () => {
    return null;
  },

  getSummaryRows: (store, _btcPrice): SummaryRow[] => {
    const newDebt = Math.max(0, store.currentUnitBorrowed - store.repayAmountUsd);
    const canFundDirectly = store.availableDirectUnitBalanceUsd >= store.repayAmountUsd;
    const useDirectUnit = !allowUsdc || canFundDirectly || store.estimatedUsdcIn === '0';

    const rows: SummaryRow[] = [];
    if (useDirectUnit) {
      rows.push({
        label: 'Funding Path',
        currentValue: 'Direct UNIT',
      });
    } else {
      rows.push(
        {
          label: 'Estimated Sepolia USDC Spend',
          currentValue: store.estimatedUsdcIn ? `${store.estimatedUsdcIn} USDC` : 'Refreshing…',
        },
        {
          label: 'Sepolia Network Fee',
          currentValue: store.estimatedSepoliaFeeEth ? `${store.estimatedSepoliaFeeEth} ETH` : 'Refreshing…',
        },
      );
    }

    rows.push(
      {
        label: 'Debt',
        currentValue: formatVaultUsd(store.currentUnitBorrowed),
        newValue: formatVaultUsd(newDebt),
        showArrow: true,
      },
      {
        label: 'Collateral (unchanged)',
        currentValue: store.currentBtcLocked.toFixed(8),
        currentUnit: 'BTC',
      },
      {
        label: 'Health Factor',
        currentValue: store.healthFactor >= 999 ? '∞' : `${store.healthFactor.toFixed(0)}%`,
        newValue: store.newHealthFactor >= 999 ? '∞' : `${store.newHealthFactor.toFixed(0)}%`,
        showArrow: true,
        valueColor: getHealthColor(store.healthFactor),
        newValueColor: getHealthColor(store.newHealthFactor),
      },
      {
        label: 'Liquidation Price',
        currentValue: `$${store.liquidationPrice.toFixed(0)}`,
        newValue: store.newLiquidationPrice === Infinity ? '$0' : `$${store.newLiquidationPrice.toFixed(0)}`,
        showArrow: true,
        valueColor: colors.semantic.error,
        newValueColor: colors.semantic.error,
      },
    );

    return rows;
  },
};
}

export function createRepayProcessingConfig(allowUsdc = true): VaultProcessingScreenConfig {
  return {
  operationType: 'repay',
  title: 'Repaying USD',
  subtitle: allowUsdc
    ? 'Please wait while we swap Sepolia USDC back into UNIT and settle the repay'
    : 'Please wait while we settle the repay with spendable UNIT',
  errorSubtitle: 'An error occurred',
  routes: repayRoutes,

  getStatusMessage: (step: number): string => {
    switch (step) {
      case 1:
        return 'Preparing transaction...';
      case 2:
        return 'Connecting to network...';
      case 3:
        return 'Validating details...';
      case 4:
        return 'Finalizing repayment...';
      default:
        return 'Processing...';
    }
  },
};
}
