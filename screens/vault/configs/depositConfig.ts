/**
 * Deposit Operation Configuration
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

export const depositRoutes = {
  input: 'DepositInput',
  confirm: 'DepositConfirm',
  processing: 'DepositProcessing',
  success: 'DepositSuccess',
};

export const depositInputConfig: VaultInputScreenConfig = {
  operationType: 'deposit',
  title: 'Deposit BTC',
  asset: 'BTC',
  routes: depositRoutes,
  checksMinHealth: false,
  changesActionType: undefined, // Uses default collateral display

  getAmountConfig: (store) => ({
    value: store.depositAmountBtc,
    setValue: store.setDepositAmountBtc,
    maxValue: store.availableBalanceBtc || 0,
    label: 'BTC to Deposit',
    isUnitAmount: false,
    hideAvailable: false,
  }),

  computePreview: (
    amount: number,
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    bitcoinPrice: number | null
  ): VaultPreview => {
    const newCollateral = effectiveBtcLocked + amount;

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
    maxAmount: number,
    _effectiveBtcLocked: number,
    _effectiveUnitBorrowed: number,
    _preview: VaultPreview,
    _hasSufficientBtcForFees: boolean
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check amount exceeds available
    if (amount > maxAmount && maxAmount > 0) {
      errors.push('Amount exceeds available balance.');
    }

    return {
      canContinue: amount > 0 && amount <= maxAmount && errors.length === 0,
      warnings,
      errors,
    };
  },

  getEmptyState: (
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    additionalData?: { availableBalanceBtc?: number }
  ): EmptyStateConfig | null => {
    // No vault
    if (effectiveBtcLocked <= 0 && effectiveUnitBorrowed <= 0) {
      return {
        icon: 'alert-circle-outline',
        iconColor: colors.semantic.warning,
        title: 'No vault found',
      };
    }

    // No BTC available
    if (additionalData?.availableBalanceBtc !== undefined && additionalData.availableBalanceBtc <= 0) {
      return {
        icon: 'alert-circle-outline',
        iconColor: colors.semantic.warning,
        title: 'No BTC Available',
        subtitle: 'You need BTC in your wallet to deposit into your vault.',
      };
    }

    return null;
  },
};

export const depositConfirmConfig: VaultConfirmScreenConfig = {
  operationType: 'deposit',
  title: 'Confirm Deposit',
  authMessage: 'Authenticate to deposit BTC',
  routes: depositRoutes,

  getPrimaryAmount: (store) => ({
    amount: store.depositAmountBtc,
    unit: 'BTC',
  }),

  executeOperation: async () => {
    return null;
  },

  getSummaryRows: (store, _btcPrice): SummaryRow[] => {
    const totalCollateral = store.currentBtcLocked + store.depositAmountBtc;

    return [
      {
        label: 'Collateral',
        currentValue: store.currentBtcLocked.toFixed(8),
        currentUnit: 'BTC',
        newValue: totalCollateral.toFixed(8),
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

export const depositProcessingConfig: VaultProcessingScreenConfig = {
  operationType: 'deposit',
  title: 'Depositing BTC',
  subtitle: 'Please wait while we process your deposit request',
  errorSubtitle: 'An error occurred',
  routes: depositRoutes,

  getStatusMessage: (step: number): string => {
    switch (step) {
      case 1:
        return 'Preparing transaction...';
      case 2:
        return 'Connecting to network...';
      case 3:
        return 'Validating details...';
      case 4:
        return 'Finalizing deposit...';
      default:
        return 'Processing...';
    }
  },
};

