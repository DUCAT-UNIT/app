/**
 * Withdraw Operation Configuration
 */

import { computeHealthFactor, computeLiquidationPrice } from '../../../utils/vaultUtils';
import { VAULT_CONFIG } from '../../../utils/constants';
import { colors } from '../../../styles/theme';
import { getHealthColor } from '../../../utils/vaultHealthColor';
import type {
  VaultInputScreenConfig,
  VaultConfirmScreenConfig,
  VaultProcessingScreenConfig,
  VaultPreview,
  ValidationResult,
  EmptyStateConfig,
  SummaryRow,
} from '../types';

export const withdrawRoutes = {
  input: 'WithdrawInput',
  confirm: 'WithdrawConfirm',
  processing: 'WithdrawProcessing',
  success: 'WithdrawSuccess',
};

export const withdrawInputConfig: VaultInputScreenConfig = {
  operationType: 'withdraw',
  title: 'Withdraw BTC',
  asset: 'BTC',
  routes: withdrawRoutes,
  checksMinHealth: true,
  changesActionType: undefined, // Uses default collateral display

  getAmountConfig: (store) => ({
    value: store.withdrawAmountBtc,
    setValue: store.setWithdrawAmountBtc,
    maxValue: Math.max(0, store.maxWithdrawable / 100_000_000),
    label: 'BTC to Withdraw',
    isUnitAmount: false,
    hideAvailable: false,
  }),

  computePreview: (
    amount: number,
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    bitcoinPrice: number | null
  ): VaultPreview => {
    const newCollateral = Math.max(0, effectiveBtcLocked - amount);

    if (!bitcoinPrice || newCollateral <= 0) {
      return {
        newCollateral,
        newDebt: effectiveUnitBorrowed,
        newHealth: 0,
        newLiqPrice: 0,
      };
    }

    // If no debt, health is infinite
    if (effectiveUnitBorrowed <= 0) {
      return {
        newCollateral,
        newDebt: 0,
        newHealth: 999,
        newLiqPrice: Infinity,
      };
    }

    return {
      newCollateral,
      newDebt: effectiveUnitBorrowed,
      newHealth: computeHealthFactor(newCollateral, bitcoinPrice, effectiveUnitBorrowed),
      newLiqPrice: computeLiquidationPrice(effectiveUnitBorrowed, newCollateral),
    };
  },

  validate: (
    amount: number,
    _maxAmount: number,
    _effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    preview: VaultPreview,
    hasSufficientBtcForFees: boolean
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const minHealth = VAULT_CONFIG.MIN_COL_RATE * 100;

    // Check min health violation (only if there's debt)
    if (amount > 0 && effectiveUnitBorrowed > 0 && preview.newHealth < minHealth) {
      errors.push(`This would put your vault below the minimum health of ${minHealth}%.`);
    }

    // Check fee balance
    if (!hasSufficientBtcForFees) {
      errors.push('Insufficient BTC for transaction fees.');
    }

    return {
      canContinue: amount > 0 && errors.length === 0,
      warnings,
      errors,
    };
  },

  getEmptyState: (
    effectiveBtcLocked: number,
    _effectiveUnitBorrowed: number
  ): EmptyStateConfig | null => {
    if (effectiveBtcLocked <= 0) {
      return {
        icon: 'alert-circle-outline',
        iconColor: colors.semantic.warning,
        title: 'No collateral to withdraw',
      };
    }
    return null;
  },
};

export const withdrawConfirmConfig: VaultConfirmScreenConfig = {
  operationType: 'withdraw',
  title: 'Confirm Withdraw',
  authMessage: 'Authenticate to withdraw BTC',
  routes: withdrawRoutes,

  getPrimaryAmount: (store) => ({
    amount: store.withdrawAmountBtc,
    unit: 'BTC',
  }),

  executeOperation: async () => {
    return null;
  },

  getSummaryRows: (store, _btcPrice): SummaryRow[] => {
    const newCollateral = Math.max(0, store.currentBtcLocked - store.withdrawAmountBtc);

    return [
      {
        label: 'Collateral',
        currentValue: store.currentBtcLocked.toFixed(8),
        currentUnit: 'BTC',
        newValue: newCollateral.toFixed(8),
        newUnit: 'BTC',
        showArrow: true,
      },
      {
        label: 'Debt (unchanged)',
        currentValue: store.currentUnitBorrowed.toFixed(2),
        currentUnit: 'UNIT',
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
        newValue: `$${store.newLiquidationPrice.toFixed(0)}`,
        showArrow: true,
        valueColor: colors.semantic.error,
        newValueColor: colors.semantic.error,
      },
    ];
  },
};

export const withdrawProcessingConfig: VaultProcessingScreenConfig = {
  operationType: 'withdraw',
  title: 'Withdrawing BTC',
  subtitle: 'Please wait while we process your withdrawal request',
  errorSubtitle: 'An error occurred',
  routes: withdrawRoutes,

  getStatusMessage: (step: number): string => {
    switch (step) {
      case 1:
        return 'Preparing transaction...';
      case 2:
        return 'Connecting to network...';
      case 3:
        return 'Validating details...';
      case 4:
        return 'Finalizing withdrawal...';
      default:
        return 'Processing...';
    }
  },
};

