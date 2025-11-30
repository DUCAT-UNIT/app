import { useResponsive } from './useResponsive';
import { ScreenSize } from '../styles/responsive';

interface VaultHealthSizeConfig {
  fontSize: number;
  iconSize: number;
  buttonSize: number;
  chartHeight: number;
}

const VAULT_HEALTH_SIZES: Record<ScreenSize, VaultHealthSizeConfig> = {
  XS: {
    fontSize: 10,
    iconSize: 12,
    buttonSize: 40,
    chartHeight: 110,
  },
  S: {
    fontSize: 11,
    iconSize: 13,
    buttonSize: 44,
    chartHeight: 120,
  },
  M: {
    fontSize: 12,
    iconSize: 14,
    buttonSize: 50,
    chartHeight: 140,
  },
  L: {
    fontSize: 12,
    iconSize: 14,
    buttonSize: 50,
    chartHeight: 140,
  },
  XL: {
    fontSize: 13,
    iconSize: 15,
    buttonSize: 54,
    chartHeight: 150,
  },
};

export interface VaultHealthStyles extends VaultHealthSizeConfig {}

export function useVaultHealthStyles(): VaultHealthStyles {
  const { screenSize } = useResponsive();

  const config = VAULT_HEALTH_SIZES[screenSize];

  return {
    ...config,
  };
}
