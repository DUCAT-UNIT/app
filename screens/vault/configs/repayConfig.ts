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
  {
    repayBalanceUsd?: number;
    directUnitBalanceUsd?: number;
    turboUnitBalanceUsd?: number;
    allowUsdc?: boolean;
    allowTurboUnit?: boolean;
  }
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
    additionalData?: {
      repayBalanceUsd?: number;
      directUnitBalanceUsd?: number;
      turboUnitBalanceUsd?: number;
      allowUsdc?: boolean;
      allowTurboUnit?: boolean;
    }
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const allowUsdc = additionalData?.allowUsdc ?? true;
    const allowTurboUnit = additionalData?.allowTurboUnit ?? true;
    const repayBalanceUsd = additionalData?.repayBalanceUsd ?? 0;
    const directUnitBalanceUsd = additionalData?.directUnitBalanceUsd ?? 0;
    const turboUnitBalanceUsd = additionalData?.turboUnitBalanceUsd ?? 0;
    const maxFundingUsd = Math.max(
      directUnitBalanceUsd,
      allowTurboUnit ? turboUnitBalanceUsd : 0,
      allowUsdc ? repayBalanceUsd : 0,
    );

    // Check repay exceeds debt
    if (amount > effectiveUnitBorrowed) {
      errors.push(`Cannot repay more than your debt (${formatVaultUsd(effectiveUnitBorrowed)}).`);
    }

    // Check repay exceeds available funding path
    if (amount > maxFundingUsd) {
      if (directUnitBalanceUsd > 0 || turboUnitBalanceUsd > 0) {
        errors.push(
          `Insufficient repayable balance. You have ${formatVaultUsd(directUnitBalanceUsd)} in spendable UNIT, ${formatVaultUsd(turboUnitBalanceUsd)} in TurboUNIT, and ${formatVaultUsd(allowUsdc ? repayBalanceUsd : 0)} in Sepolia USDC.`,
        );
      } else if (allowUsdc) {
        errors.push(`Insufficient Sepolia USDC or TurboUNIT balance. You have ${formatVaultUsd(repayBalanceUsd)} in Sepolia USDC and ${formatVaultUsd(turboUnitBalanceUsd)} in TurboUNIT.`);
      } else {
        errors.push(`Insufficient spendable UNIT or TurboUNIT balance. You have ${formatVaultUsd(directUnitBalanceUsd)} in spendable UNIT and ${formatVaultUsd(turboUnitBalanceUsd)} in TurboUNIT.`);
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
    additionalData?: {
      repayBalanceUsd?: number;
      directUnitBalanceUsd?: number;
      turboUnitBalanceUsd?: number;
      allowUsdc?: boolean;
      allowTurboUnit?: boolean;
    }
  ): EmptyStateConfig | null => {
    const allowUsdc = additionalData?.allowUsdc ?? true;
    const allowTurboUnit = additionalData?.allowTurboUnit ?? true;
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
      && (allowTurboUnit ? (additionalData?.turboUnitBalanceUsd ?? 0) <= 0 : true)
      && (additionalData?.directUnitBalanceUsd ?? 0) <= 0
    ) {
      return {
        icon: 'alert-circle-outline',
        iconColor: colors.semantic.warning,
        title: 'No Repayable Balance',
        subtitle: allowUsdc
          ? `You need spendable UNIT, TurboUNIT, or Sepolia USDC to repay your debt of ${formatVaultUsd(effectiveUnitBorrowed)}.`
          : `You need spendable UNIT or TurboUNIT to repay your debt of ${formatVaultUsd(effectiveUnitBorrowed)}.`,
      };
    }

    return null;
  },
};

export function createRepayConfirmConfig({
  allowUsdc = true,
  allowTurboUnit = true,
}: {
  allowUsdc?: boolean;
  allowTurboUnit?: boolean;
} = {}): VaultConfirmScreenConfig<RepayVaultStore> {
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
    const canFundTurboUnit = allowTurboUnit && store.availableTurboUnitBalanceUsd >= store.repayAmountUsd;
    const useDirectUnit = canFundDirectly || (store.estimatedUsdcIn === '0' && store.estimatedTurboUnitIn === '0');

    const rows: SummaryRow[] = [];
    if (useDirectUnit) {
      rows.push({
        label: 'Funding Path',
        currentValue: 'Direct UNIT',
      });
    } else if (canFundTurboUnit || store.estimatedTurboUnitIn) {
      rows.push(
        {
          label: 'Funding Path',
          currentValue: 'TurboUNIT',
        },
        {
          label: 'Estimated TurboUNIT Spend',
          currentValue: store.estimatedTurboUnitIn ? `${store.estimatedTurboUnitIn} TurboUNIT` : 'Refreshing...',
        },
      );
      if (store.estimatedTurboUnitFee && store.estimatedTurboUnitFee !== '0') {
        rows.push({
          label: 'Cashu Mint Fee',
          currentValue: `${store.estimatedTurboUnitFee} TurboUNIT`,
        });
      }
    } else if (allowUsdc) {
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
    } else {
      rows.push({
        label: 'Funding Path',
        currentValue: 'UNIT or TurboUNIT',
      });
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
    ? 'Please wait while we prepare UNIT funding and settle the repay'
    : 'Please wait while we settle the repay with spendable UNIT or TurboUNIT',
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
