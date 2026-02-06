/**
 * Borrow Operation Configuration
 */

import { computeHealthFactor, computeLiquidationPrice } from '../../../utils/vaultUtils';
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

export const borrowRoutes = {
  input: 'BorrowInput',
  confirm: 'BorrowConfirm',
  processing: 'BorrowProcessing',
  success: 'BorrowSuccess',
};

export const borrowInputConfig: VaultInputScreenConfig = {
  operationType: 'borrow',
  title: 'Borrow UNIT',
  asset: 'UNIT',
  routes: borrowRoutes,
  checksMinHealth: true,
  changesActionType: 'debt',

  getAmountConfig: (store) => ({
    value: store.borrowAmount,
    setValue: store.setBorrowAmount,
    maxValue: store.maxBorrowable !== null ? Math.max(0, Math.floor(store.maxBorrowable)) : 0,
    label: 'UNIT to Borrow',
    isUnitAmount: true,
    hideAvailable: true,
  }),

  computePreview: (
    amount: number,
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    bitcoinPrice: number | null
  ): VaultPreview => {
    const newDebt = effectiveUnitBorrowed + amount;

    if (!bitcoinPrice || effectiveBtcLocked <= 0 || newDebt <= 0) {
      return {
        newCollateral: effectiveBtcLocked,
        newDebt,
        newHealth: 0,
        newLiqPrice: 0,
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
    _effectiveUnitBorrowed: number,
    preview: VaultPreview,
    hasSufficientBtcForFees: boolean
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check min health violation
    if (amount > 0 && preview.newHealth < 160) {
      errors.push('This would put your vault below the minimum health of 160%.');
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
        title: 'No vault found',
      };
    }
    return null;
  },
};

export const borrowConfirmConfig: VaultConfirmScreenConfig = {
  operationType: 'borrow',
  title: 'Confirm Borrow',
  authMessage: 'Authenticate to borrow UNIT',
  routes: borrowRoutes,

  getPrimaryAmount: (store) => ({
    amount: store.borrowAmount,
    unit: 'UNIT',
  }),

  executeOperation: async () => {
    // This will be called from the hook
    return null;
  },

  getSummaryRows: (store, _btcPrice): SummaryRow[] => {
    const totalDebt = store.currentUnitBorrowed + store.borrowAmount;

    return [
      {
        label: 'Debt',
        currentValue: store.currentUnitBorrowed.toFixed(2),
        currentUnit: 'UNIT',
        newValue: totalDebt.toFixed(2),
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
        newValue: `$${store.newLiquidationPrice.toFixed(0)}`,
        showArrow: true,
        valueColor: colors.semantic.error,
        newValueColor: colors.semantic.error,
      },
    ];
  },
};

export const borrowProcessingConfig: VaultProcessingScreenConfig = {
  operationType: 'borrow',
  title: 'Borrowing UNIT',
  subtitle: 'Please wait while we process your borrow request',
  errorSubtitle: 'An error occurred',
  routes: borrowRoutes,

  getStatusMessage: (step: number): string => {
    switch (step) {
      case 1:
        return 'Preparing transaction...';
      case 2:
        return 'Connecting to network...';
      case 3:
        return 'Validating details...';
      case 4:
        return 'Finalizing borrow...';
      default:
        return 'Processing...';
    }
  },
};

