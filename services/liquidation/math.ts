import { COIN_SIZE } from './constants';

export function roundNumber(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundNumberDown(value: number, decimals = 8): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}

export function satsToBtc(sats: number): number {
  return sats / COIN_SIZE;
}
