import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  clearStoredQuantaAddress,
  getQuantaMobileRewardStatus,
  getStoredQuantaAddress,
  type QuantaRewardStatusResult,
} from '../../services/quantaRewardService';
import { logger } from '../../utils/logger';
import type { QuantaMobileWalletPayload } from './quantaLinkUtils';

interface UseQuantaRewardStatusParams {
  getQuantaMobileWalletPayload: (address?: string | null) => QuantaMobileWalletPayload;
  onDisplayAddress: (address: string) => void;
}

interface QuantaRewardStatusResponse {
  displayAddress: string | null;
  status: QuantaRewardStatusResult;
}

interface UseQuantaRewardStatusResult {
  fetchQuantaRewardStatus: (
    preferredAddress?: string | null
  ) => Promise<QuantaRewardStatusResponse>;
  rewardStatus: QuantaRewardStatusResult | null;
  setRewardStatus: React.Dispatch<React.SetStateAction<QuantaRewardStatusResult | null>>;
}

export function useQuantaRewardStatus({
  getQuantaMobileWalletPayload,
  onDisplayAddress,
}: UseQuantaRewardStatusParams): UseQuantaRewardStatusResult {
  const [rewardStatus, setRewardStatus] = React.useState<QuantaRewardStatusResult | null>(null);

  const fetchQuantaRewardStatus = React.useCallback(
    async (preferredAddress?: string | null): Promise<QuantaRewardStatusResponse> => {
      const storedAddress = preferredAddress ?? (await getStoredQuantaAddress());
      const status = await getQuantaMobileRewardStatus({
        quantaAddress: storedAddress,
        ...getQuantaMobileWalletPayload(storedAddress),
      });

      return {
        status,
        displayAddress: storedAddress ?? status.user?.test_net_wallet ?? null,
      };
    },
    [getQuantaMobileWalletPayload]
  );

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      fetchQuantaRewardStatus()
        .then(({ status, displayAddress }) => {
          if (!isActive) {
            return;
          }

          if (status.connected) {
            setRewardStatus(status);
          } else {
            setRewardStatus(null);
            onDisplayAddress('');
            clearStoredQuantaAddress().catch((error: unknown) => {
              logger.warn('[QuantaLinkScreen] Failed to clear stale Quanta link', {
                error: error instanceof Error ? error.message : String(error),
              });
            });
          }
          if (displayAddress && status.connected) {
            onDisplayAddress(displayAddress);
          }
        })
        .catch((error: unknown) => {
          if (!isActive) {
            return;
          }

          logger.warn('[QuantaLinkScreen] Failed to load Quanta reward status', {
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return () => {
        isActive = false;
      };
    }, [fetchQuantaRewardStatus, onDisplayAddress])
  );

  return {
    fetchQuantaRewardStatus,
    rewardStatus,
    setRewardStatus,
  };
}
