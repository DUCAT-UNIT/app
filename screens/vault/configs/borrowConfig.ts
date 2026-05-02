/**
 * Borrow Operation Configuration
 */

import { computeHealthFactor, computeLiquidationPrice, getHealthColorFromValue as getHealthColor } from '../../../utils/vaultUtils';
import { formatVaultUsd } from '../../../utils/vaultFaceValue';
import { colors } from '../../../styles/theme';
import { useVaultSettlementStore } from '../../../stores/vaultSettlementStore';
import { getVaultSettlementStatusMessage } from '../../../services/vaultSettlementService';
import type {
  BorrowVaultStore,
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
  selection: 'BorrowPayout',
  confirm: 'BorrowConfirm',
  processing: 'BorrowProcessing',
  success: 'BorrowSuccess',
};

export const borrowInputConfig: VaultInputScreenConfig<BorrowVaultStore> = {
  operationType: 'borrow',
  title: 'Borrow USD',
  asset: 'USD',
  routes: borrowRoutes,
  checksMinHealth: true,
  changesActionType: 'debt',

  getAmountConfig: (store) => ({
    value: store.borrowAmountUsd,
    setValue: store.setBorrowAmountUsd,
    maxValue: store.maxBorrowableUsd !== null ? Math.max(0, Math.floor(store.maxBorrowableUsd)) : 0,
    label: 'USD to Borrow',
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

export function createBorrowConfirmConfig(
  estimatedUsdcOut?: string | null,
  receiveAsset: 'USDC' | 'UNIT' = 'UNIT',
): VaultConfirmScreenConfig<BorrowVaultStore> {
  return {
    operationType: 'borrow',
    title: 'Confirm Borrow',
    authMessage: 'Authenticate to borrow USD',
    routes: borrowRoutes,

    getPrimaryAmount: (store) => ({
      amount: store.borrowAmountUsd,
      unit: 'USD',
    }),

    executeOperation: async () => {
      return null;
    },

    getSummaryRows: (store, _btcPrice): SummaryRow[] => {
      const totalDebt = store.currentUnitBorrowed + store.borrowAmountUsd;
      const rows: SummaryRow[] = [
        {
          label: 'Debt',
          currentValue: formatVaultUsd(store.currentUnitBorrowed),
          newValue: formatVaultUsd(totalDebt),
          showArrow: true,
        },
        {
          label: 'Receive As',
          currentValue: receiveAsset,
          badgeAsset: receiveAsset,
        },
      ];

      if (receiveAsset === 'USDC' && estimatedUsdcOut) {
        rows.push({
          label: 'Estimated Sepolia USDC Received',
          currentValue: `${estimatedUsdcOut} USDC`,
        });
      } else if (receiveAsset === 'UNIT') {
        rows.push({
          label: 'Estimated UNIT Received',
          currentValue: `${store.borrowAmountUsd.toFixed(2)} UNIT`,
        });
      }

      rows.push(
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
      );

      return rows;
    },
  };
}

export const borrowProcessingConfig: VaultProcessingScreenConfig = {
  operationType: 'borrow',
  title: 'Borrowing USD',
  subtitle: 'Please wait while we process your borrow request',
  errorSubtitle: 'An error occurred',
  routes: borrowRoutes,

  getStatusMessage: (step: number): string => {
    const { kind, phase } = useVaultSettlementStore.getState();
    return getVaultSettlementStatusMessage(kind, phase, step);
  },
};
