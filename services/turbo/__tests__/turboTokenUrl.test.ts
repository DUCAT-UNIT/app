import {
  isShortCashuTokenUrl,
  resolveCashuTokenFromUrl,
} from '../turboTokenUrl';

describe('turboTokenUrl', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock;
  });

  it('recognizes only HTTPS short token URLs', () => {
    expect(isShortCashuTokenUrl('https://short.ducatprotocol.com/abc123')).toBe(true);
    expect(isShortCashuTokenUrl('http://short.ducatprotocol.com/abc123')).toBe(false);
  });

  it('does not fetch HTTP shortener URLs', async () => {
    await expect(resolveCashuTokenFromUrl('http://short.ducatprotocol.com/abc123')).resolves.toBeNull();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
