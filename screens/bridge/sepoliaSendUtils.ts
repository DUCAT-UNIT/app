import type { SepoliaTransferAsset } from '../../services/evmBridgeService';

export function formatTokenAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(numeric);
}

export function formatEthAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 ETH';
  }

  return `${numeric.toFixed(numeric < 0.001 ? 6 : 4)} ETH`;
}

export function formatAmountInputValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  const formatted = value.toFixed(6).replace(/\.?0+$/, '');
  return formatted === '0' ? '' : formatted;
}

export function formatSelectableAmount(value: number, asset: SepoliaTransferAsset): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  const decimals = asset === 'ETH' ? 6 : 6;
  const formatted = value.toFixed(decimals).replace(/\.?0+$/, '');
  return formatted === '0' ? '' : formatted;
}

export function getSepoliaAssetLabel(asset: SepoliaTransferAsset): string {
  if (asset === 'USDC') return 'Sepolia USDC';
  if (asset === 'ETH') return 'Sepolia ETH';
  return asset;
}

export function getSepoliaAssetUnit(asset: SepoliaTransferAsset): string {
  return asset === 'USDC' ? 'USDC' : asset;
}

export function getSepoliaAssetDecimals(asset: SepoliaTransferAsset): number {
  return asset === 'ETH' ? 18 : 6;
}

export function getAmountPlaceholder(asset: SepoliaTransferAsset): string {
  return asset === 'ETH' ? '0.0000' : '0.00';
}

export function getAssetIconName(asset: SepoliaTransferAsset): string {
  if (asset === 'USDC') return 'usdc_logo';
  if (asset === 'ETH') return 'eth_logo';
  return 'unit_symbol';
}

export function sanitizeAmountInput(value: string, decimals: number): string {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const firstDotIndex = normalized.indexOf('.');
  const wholeRaw = firstDotIndex === -1 ? normalized : normalized.slice(0, firstDotIndex);
  const decimalRaw =
    firstDotIndex === -1 ? '' : normalized.slice(firstDotIndex + 1).replace(/\./g, '');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '');

  if (firstDotIndex !== -1) {
    return `${whole || '0'}.${decimalRaw.slice(0, decimals)}`;
  }

  return whole;
}

export function getSepoliaSendTitle(asset: SepoliaTransferAsset): string {
  if (asset === 'ETH') return 'Send ETH';
  if (asset === 'USDC') return 'Send Sepolia USDC';
  return 'Send wUNIT';
}

export function formatReviewAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 18) {
    return trimmed;
  }
  return `${trimmed.slice(0, 10)}...${trimmed.slice(-8)}`;
}

export function normalizeScannedAddress(data: string): string {
  const trimmed = data.trim();
  const ethereumMatch = trimmed.match(/^(?:ethereum:)?(0x[a-fA-F0-9]{40})/);
  return ethereumMatch?.[1] ?? trimmed;
}
