const MICRO_UNIT = 1_000_000n;
const CENTI_UNIT = 100n;

export function parseUnits6(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Amount is required');
  }

  const match = trimmed.match(/^(\d+)(?:\.(\d{1,6})?)?$/);
  if (!match) {
    throw new Error(`Invalid 6-decimal amount: ${value}`);
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] || '').padEnd(6, '0');
  return (whole * MICRO_UNIT) + BigInt(fraction || '0');
}

export function formatUnits6(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / MICRO_UNIT;
  const fraction = (absolute % MICRO_UNIT).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function parseUnits2(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Amount is required');
  }

  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2})?)?$/);
  if (!match) {
    throw new Error(`Invalid 2-decimal amount: ${value}`);
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] || '').padEnd(2, '0');
  return (whole * CENTI_UNIT) + BigInt(fraction || '0');
}

export function microsToMutinynetBaseUnits(value: bigint): bigint {
  if (value % 10_000n !== 0n) {
    throw new Error('Mutinynet UNIT amounts must align to 0.01 increments');
  }

  return value / 10_000n;
}

export function mutinynetBaseUnitsToMicros(value: bigint): bigint {
  return value * 10_000n;
}
