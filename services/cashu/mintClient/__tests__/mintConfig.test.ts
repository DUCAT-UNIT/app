describe('mintConfig', () => {
  it('uses the advertised Ducat dev Cashu mint only', () => {
    const config = require('../mintConfig') as typeof import('../mintConfig');

    expect(config.MINT_URL).toBe('https://dev-cashu-mint.ducatprotocol.com');
    expect(config.CASHU_UNIT).toBe('unit');
    expect(config.RUNE_ID).toBe('1527352:1');
  });
});
