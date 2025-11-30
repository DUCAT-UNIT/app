import { useMemo } from 'react';
import { TextStyle } from 'react-native';
import { useResponsive } from './useResponsive';
import { wallet } from '../styles/screens';
import { TotalBalanceSectionStyles } from '../components/wallet/TotalBalanceSection';

const LARGE_BALANCE_THRESHOLD = 10000000;

interface UseTotalBalanceStylesParams {
  totalBalanceUSD: number;
}

interface UseTotalBalanceStylesReturn {
  styles: TotalBalanceSectionStyles;
  largeBalanceStyle?: TextStyle;
}

export function useTotalBalanceStyles({
  totalBalanceUSD,
}: UseTotalBalanceStylesParams): UseTotalBalanceStylesReturn {
  const { scale } = useResponsive();

  const styles = useMemo<TotalBalanceSectionStyles>(
    () => ({
      xverseBalanceSection: wallet.xverseBalanceSection,
      xverseBalanceLeft: wallet.xverseBalanceLeft,
      xverseBalanceLabel: wallet.xverseBalanceLabel,
      balanceWithIcon: wallet.balanceWithIcon,
      balanceIcon: wallet.balanceIcon,
      xverseBalanceAmount: wallet.xverseBalanceAmount,
    }),
    []
  );

  const isLargeBalance = totalBalanceUSD >= LARGE_BALANCE_THRESHOLD;
  const largeBalanceStyle = useMemo<TextStyle | undefined>(() => {
    if (!isLargeBalance) {
      return undefined;
    }
    return wallet.totalBalanceAmountSmall;
  }, [isLargeBalance]);

  return {
    styles,
    largeBalanceStyle,
  };
}
