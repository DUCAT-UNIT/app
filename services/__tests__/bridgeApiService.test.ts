jest.mock('../../utils/apiClient', () => ({
  postJSON: jest.fn(),
  getJSON: jest.fn(),
}));

describe('bridgeApiService', () => {
  const originalApiBase = process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL = 'https://bridge.example';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL = originalApiBase;
  });

  it('creates bridge intents against the configured backend', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createBridgeIntent } = require('../bridgeApiService');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        intent: { id: 'intent-1', status: 'pending', depositAddress: 'tb1p-test' },
      })),
    });

    const result = await createBridgeIntent({
      amount: '25',
      autoSwap: true,
      sepoliaRecipient: '0x1111111111111111111111111111111111111111',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://bridge.example/bridge/create-intent?'),
      { method: 'GET' },
    );
    expect(result).toEqual(expect.objectContaining({ id: 'intent-1', status: 'pending' }));
  });

  it('recovers a created bridge intent by client request id after a timeout', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createBridgeIntent } = require('../bridgeApiService');

    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          intent: { id: 'intent-recovered', status: 'pending', depositAddress: 'tb1p-recovered' },
        })),
      });

    const promise = createBridgeIntent({
      amount: '10',
      autoSwap: true,
      sepoliaRecipient: '0x1111111111111111111111111111111111111111',
    });

    const result = await promise;

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/bridge/intents/by-client-request-id/'),
      { method: 'GET' },
    );
    expect(result).toEqual(expect.objectContaining({ id: 'intent-recovered', status: 'pending' }));
  });

  it('fetches a bridge intent by client request id for crash recovery', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getBridgeIntentByClientRequestId } = require('../bridgeApiService');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: jest.fn(() => null) },
      text: jest.fn().mockResolvedValue(JSON.stringify({
        intent: { id: 'intent-lookup', status: 'pending', depositAddress: 'tb1p-lookup' },
      })),
    });

    await expect(getBridgeIntentByClientRequestId('client request/1')).resolves.toEqual(
      expect.objectContaining({
        id: 'intent-lookup',
        status: 'pending',
        depositAddress: 'tb1p-lookup',
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://bridge.example/bridge/intents/by-client-request-id/client%20request%2F1',
      { method: 'GET' },
    );
  });

  it('returns null when a bridge intent is not indexed by client request id yet', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getBridgeIntentByClientRequestId } = require('../bridgeApiService');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: jest.fn(() => null) },
      text: jest.fn().mockResolvedValue(''),
    });

    await expect(getBridgeIntentByClientRequestId('missing-client')).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://bridge.example/bridge/intents/by-client-request-id/missing-client',
      { method: 'GET' },
    );
  });

  it('uses the built-in Sepolia bridge API when the env override is missing', async () => {
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL = '';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getBridgeStatus } = require('../bridgeApiService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getJSON } = require('../../utils/apiClient');
    (getJSON as jest.Mock).mockResolvedValueOnce({ id: 'intent-1', status: 'fulfilled' });

    await expect(getBridgeStatus('intent-1')).resolves.toEqual(
      expect.objectContaining({ id: 'intent-1', status: 'fulfilled' }),
    );
    expect(getJSON).toHaveBeenCalledWith(
      expect.stringContaining('/bridge/intents/intent-1'),
      expect.any(Object),
    );
  });

  it('reports malformed bridge intent responses instead of leaking JSON parser errors', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createBridgeIntent } = require('../bridgeApiService');

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: jest.fn(() => null) },
        text: jest.fn().mockResolvedValue('not-json'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        headers: { get: jest.fn(() => null) },
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'bridge down' })),
      });

    await expect(createBridgeIntent({
      amount: '10',
      autoSwap: true,
      sepoliaRecipient: '0x1111111111111111111111111111111111111111',
    }))
      .rejects
      .toThrow('Bridge intent response was not valid JSON');
  });

  it('fetches bridge and redemption status from the backend', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getJSON } = require('../../utils/apiClient');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      getBridgeStatus,
      getRedemptionStatus,
    } = require('../bridgeApiService');

    (getJSON as jest.Mock)
      .mockResolvedValueOnce({ id: 'intent-1', status: 'fulfilled' })
      .mockResolvedValueOnce({ id: 'release-1', status: 'pending_release' });

    const intent = await getBridgeStatus('intent-1');
    const redemption = await getRedemptionStatus('release-1');

    expect(getJSON).toHaveBeenNthCalledWith(
      1,
      'https://bridge.example/bridge/intents/intent-1',
      expect.objectContaining({ description: 'Fetch Sepolia bridge intent status' }),
    );
    expect(getJSON).toHaveBeenNthCalledWith(
      2,
      'https://bridge.example/redemptions/release-1',
      expect.objectContaining({ description: 'Fetch redemption release status' }),
    );
    expect(intent.status).toBe('fulfilled');
    expect(redemption.status).toBe('pending_release');
  });
});
