import {
  getStaleLiquidationOpportunityMessage,
  isStaleLiquidationOpportunityError,
} from '../liquidationErrors';

describe('liquidationErrors', () => {
  it('detects stale liquidation opportunity errors from guardian validation', () => {
    expect(
      isStaleLiquidationOpportunityError(
        'Validation of RepoVault failed: "UTXO spent: abc is spent or not exist"'
      )
    ).toBe(true);
  });

  it('detects guardian repo Tx1 mismatch responses as changed opportunities', () => {
    expect(
      isStaleLiquidationOpportunityError(
        '{"code":null,"message":"Message: Repo Vault Tx1ID in request does not match computed Repo vault Tx1ID"}'
      )
    ).toBe(true);
  });

  it('does not treat generic liquidation failures as stale opportunities', () => {
    expect(isStaleLiquidationOpportunityError('Insufficient funds')).toBe(false);
    expect(isStaleLiquidationOpportunityError(null)).toBe(false);
  });

  it('builds friendly retry copy with the remaining opportunity count', () => {
    expect(getStaleLiquidationOpportunityMessage(2)).toBe(
      'Seems like someone got to this yield opportunity before you did. There are 2 other vaults still left to liquidate. Want to try again?'
    );
    expect(getStaleLiquidationOpportunityMessage(1)).toContain('There is 1 other vault');
    expect(getStaleLiquidationOpportunityMessage(0)).toContain('no other vaults');
  });
});
