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

  it('does not hide guardian repo Tx1 mismatch responses as already claimed opportunities', () => {
    expect(
      isStaleLiquidationOpportunityError(
        '{"code":null,"message":"Message: Repo Vault Tx1ID in request does not match computed Repo vault Tx1ID"}'
      )
    ).toBe(false);
  });

  it('keeps escaped guardian repo Tx1 mismatch details visible for debugging', () => {
    expect(
      isStaleLiquidationOpportunityError(
        '{"code":null,"message":"Message: Repo Vault Tx1 ID in request does not match computed Repo Tx1ID Error: Custom(\\"Repo Vault Tx1ID d85cd3 in request does not match computed Repo vault Tx1ID aa885d\\")"}'
      )
    ).toBe(false);
  });

  it('detects already-claimed liquidation opportunity responses', () => {
    expect(
      isStaleLiquidationOpportunityError(
        'Vault was already claimed by another liquidation transaction'
      )
    ).toBe(true);
    expect(isStaleLiquidationOpportunityError('Opportunity already liquidated')).toBe(true);
  });

  it('detects missing liquidation outpoint responses from validator pre-check', () => {
    expect(
      isStaleLiquidationOpportunityError(
        'Validator pre-check: Validation failed: Failed to find utxo for a41d9f:1 input for outpoint c9b847:1'
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
