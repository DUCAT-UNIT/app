/**
 * Repay Operation Configuration
 */

import { computeHealthFactor, computeLiquidationPrice, getHealthColorFromValue as getHealthColor } from '../../../utils/vaultUtils';
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
  { unitBalance?: number }
> = {
  operationType: 'repay',
  title: 'Repay UNIT',
  asset: 'UNIT',
  routes: repayRoutes,
  checksMinHealth: false,
  changesActionType: 'debt',

  getAmountConfig: (store) => ({
    value: store.repayAmountUnit,
    setValue: store.setRepayAmountUnit,
    maxValue: Math.max(0, Math.floor(store.maxRepayable || 0)),
    label: 'UNIT to Repay',
    isUnitAmount: true,
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
    additionalData?: { unitBalance?: number }
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const unitBalance = additionalData?.unitBalance ?? 0;

    // Check repay exceeds debt
    if (amount > effectiveUnitBorrowed) {
      errors.push(`Cannot repay more than your debt (${effectiveUnitBorrowed.toFixed(2)} UNIT)`);
    }

    // Check repay exceeds balance
    if (amount > unitBalance) {
      errors.push(`Insufficient UNIT balance. You have ${unitBalance.toFixed(2)} UNIT available.`);
    }

    // Check fee balance
    if (!hasSufficientBtcForFees) {
      errors.push('Insufficient BTC for transaction fees.');
    }

    return {
      canContinue: amount > 0 && amount <= effectiveUnitBorrowed && amount <= unitBalance && hasSufficientBtcForFees,
      warnings,
      errors,
    };
  },

  getEmptyState: (
    _effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    additionalData?: { unitBalance?: number }
  ): EmptyStateConfig | null => {
    // No debt
    if (effectiveUnitBorrowed <= 0) {
      return {
        icon: 'checkmark-circle-outline',
        iconColor: colors.semantic.success,
        title: 'No debt to repay',
      };
    }

    // No UNIT balance
    if (additionalData?.unitBalance !== undefined && additionalData.unitBalance <= 0) {
      return {
        icon: 'alert-circle-outline',
        iconColor: colors.semantic.warning,
        title: 'No UNIT Available',
        subtitle: `You need UNIT to repay your debt of ${effectiveUnitBorrowed.toFixed(2)} UNIT.`,
      };
    }

    return null;
  },
};

export const repayConfirmConfig: VaultConfirmScreenConfig<RepayVaultStore> = {
  operationType: 'repay',
  title: 'Confirm Repay',
  authMessage: 'Authenticate to repay UNIT',
  routes: repayRoutes,

  getPrimaryAmount: (store) => ({
    amount: store.repayAmountUnit,
    unit: 'UNIT',
  }),

  executeOperation: async () => {
    return null;
  },

  getSummaryRows: (store, _btcPrice): SummaryRow[] => {
    const newDebt = Math.max(0, store.currentUnitBorrowed - store.repayAmountUnit);

    return [
      {
        label: 'Debt',
        currentValue: store.currentUnitBorrowed.toFixed(2),
        currentUnit: 'UNIT',
        newValue: newDebt.toFixed(2),
        newUnit: 'UNIT',
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
    ];
  },
};

export const repayProcessingConfig: VaultProcessingScreenConfig = {
  operationType: 'repay',
  title: 'Repaying UNIT',
  subtitle: 'Please wait while we process your repay request',
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
