// @ts-nocheck
/**
 * Tests for Address Formatting Utilities
 */

import {
  truncateAddress,
  truncateTxid,
  looksLikeBitcoinAddress,
  getAddressType,
} from '../addresses';

describe('truncateAddress', () => {
  it('should truncate long addresses correctly', () => {
    const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const result = truncateAddress(address);
    expect(result).toBe('bc1qar0s...zzwf5mdq');
  });

  it('should use custom start and end chars', () => {
    const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const result = truncateAddress(address, 5, 5);
    expect(result).toBe('bc1qa...f5mdq');
  });

  it('should return short addresses unchanged', () => {
    const shortAddress = 'bc1qshort';
    expect(truncateAddress(shortAddress)).toBe(shortAddress);
  });

  it('should handle empty or null addresses', () => {
    expect(truncateAddress('')).toBe('');
    expect(truncateAddress(null)).toBe('');
    expect(truncateAddress(undefined)).toBe('');
  });

  it('should handle non-string addresses by converting to string', () => {
    expect(truncateAddress(12345)).toBe('12345');
  });

  it('should handle addresses exactly at length threshold', () => {
    const address = '1234567890123456'; // 16 chars (8 + 8)
    expect(truncateAddress(address)).toBe(address);
  });
});

describe('truncateTxid', () => {
  it('should truncate long transaction IDs correctly', () => {
    const txid = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
    const result = truncateTxid(txid);
    expect(result).toBe('a1b2c3d4...w3x4y5z6');
  });

  it('should use custom start and end chars', () => {
    const txid = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
    const result = truncateTxid(txid, 6, 6);
    expect(result).toBe('a1b2c3...x4y5z6');
  });

  it('should return short txids unchanged', () => {
    const shortTxid = 'short';
    expect(truncateTxid(shortTxid)).toBe(shortTxid);
  });

  it('should handle empty or null txids', () => {
    expect(truncateTxid('')).toBe('');
    expect(truncateTxid(null)).toBe('');
    expect(truncateTxid(undefined)).toBe('');
  });

  it('should handle non-string txids by converting to string', () => {
    expect(truncateTxid(12345)).toBe('12345');
  });
});

describe('looksLikeBitcoinAddress', () => {
  it('should return true for legacy addresses', () => {
    expect(looksLikeBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
  });

  it('should return true for P2SH addresses', () => {
    expect(looksLikeBitcoinAddress('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy')).toBe(true);
  });

  it('should return true for bech32 SegWit addresses', () => {
    expect(looksLikeBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
  });

  it('should return true for testnet addresses', () => {
    expect(looksLikeBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true);
  });

  it('should return true for regtest addresses', () => {
    expect(looksLikeBitcoinAddress('bcrt1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
  });

  it('should return false for too short addresses', () => {
    expect(looksLikeBitcoinAddress('bc1qshort')).toBe(false);
  });

  it('should return false for too long addresses', () => {
    const tooLong = 'bc1q' + 'a'.repeat(60);
    expect(looksLikeBitcoinAddress(tooLong)).toBe(false);
  });

  it('should return false for invalid prefixes', () => {
    expect(looksLikeBitcoinAddress('invalid_address_with_enough_characters')).toBe(false);
  });

  it('should return false for empty or null addresses', () => {
    expect(looksLikeBitcoinAddress('')).toBe(false);
    expect(looksLikeBitcoinAddress(null)).toBe(false);
    expect(looksLikeBitcoinAddress(undefined)).toBe(false);
  });

  it('should return false for non-string addresses', () => {
    expect(looksLikeBitcoinAddress(12345)).toBe(false);
  });
});

describe('getAddressType', () => {
  it('should identify legacy addresses', () => {
    expect(getAddressType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('legacy');
  });

  it('should identify P2SH addresses as segwit', () => {
    expect(getAddressType('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy')).toBe('segwit');
  });

  it('should identify bech32 SegWit addresses (bc1q)', () => {
    expect(getAddressType('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('segwit');
  });

  it('should identify testnet SegWit addresses (tb1q)', () => {
    expect(getAddressType('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe('segwit');
  });

  it('should identify Taproot addresses (bc1p)', () => {
    expect(getAddressType('bc1pxwww0ct9ue7e8tdnlmug5m2tamfn7q06sahstg39ys4c9f3340qqxrdu9k')).toBe('taproot');
  });

  it('should identify testnet Taproot addresses (tb1p)', () => {
    expect(getAddressType('tb1pxwww0ct9ue7e8tdnlmug5m2tamfn7q06sahstg39ys4c9f3340qqxrdu9k')).toBe('taproot');
  });

  it('should return unknown for invalid addresses', () => {
    expect(getAddressType('invalid_address')).toBe('unknown');
  });

  it('should return unknown for empty or null addresses', () => {
    expect(getAddressType('')).toBe('unknown');
    expect(getAddressType(null)).toBe('unknown');
    expect(getAddressType(undefined)).toBe('unknown');
  });

  it('should return unknown for non-string addresses', () => {
    expect(getAddressType(12345)).toBe('unknown');
  });
});
