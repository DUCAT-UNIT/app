import { useResponsive } from './useResponsive';

export interface PromotionStyles {
  iconSize: number;
  titleSize: number;
  messageSize: number;
  buttonTextSize: number;
  padding: number;
  buttonPadding: number;
  overlayPadding: number;
  borderRadius: number;
  iconPaddingBottom: number;
  titleMarginBottom: number;
  messageLineHeight: number;
  messageMarginBottom: number;
  buttonBorderRadius: number;
}

export function usePromotionStyles(): PromotionStyles {
  const { scale } = useResponsive();

  return {
    iconSize: 55 * scale,
    titleSize: 22 * scale,
    messageSize: 16 * scale,
    buttonTextSize: 16 * scale,
    padding: 32 * scale,
    buttonPadding: 16 * scale,
    overlayPadding: 24 * scale,
    borderRadius: 24 * scale,
    iconPaddingBottom: 24 * scale,
    titleMarginBottom: 12 * scale,
    messageLineHeight: 16 * scale * 1.5,
    messageMarginBottom: 24 * scale,
    buttonBorderRadius: 12 * scale,
  };
}
