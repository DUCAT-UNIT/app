const mockStorage = new Map<string, string>();
const mockTrack = jest.fn();
const mockFlush = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('../analyticsService', () => ({
  analytics: {
    track: mockTrack,
    flush: mockFlush,
  },
}));

const STORAGE_KEY = 'startup_diagnostics_state_v1';

async function flushAsyncWork(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('startupDiagnostics', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockTrack.mockClear();
    mockFlush.mockClear();
  });

  it('persists checkpoints and completion for the current attempt', async () => {
    const { startupDiagnostics } = require('../startupDiagnostics');

    await startupDiagnostics.beginAttempt();
    startupDiagnostics.recordCheckpoint('native_splash_hide', { reason: 'layout' }, { flush: true });
    startupDiagnostics.markComplete({ wallet_exists: false });
    await flushAsyncWork();

    const raw = mockStorage.get(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw as string);
    expect(parsed.attempts).toHaveLength(1);
    expect(parsed.attempts[0].status).toBe('completed');
    expect(parsed.attempts[0].events.map((event: { name: string }) => event.name)).toEqual([
      'attempt_started',
      'native_splash_hide',
      'startup_complete',
    ]);

    expect(mockTrack).toHaveBeenCalledWith(
      'startup_complete',
      expect.objectContaining({
        startup_status: 'completed',
        wallet_exists: false,
      }),
    );
    expect(mockFlush).toHaveBeenCalled();
  });

  it('reports a previously unfinished attempt on the next launch', async () => {
    mockStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        attempts: [
          {
            id: 'old-attempt',
            status: 'running',
            started_at: '2026-04-15T12:00:00.000Z',
            started_at_ms: 1000,
            app_version: '1.0.0',
            build_number: '53',
            platform: 'ios',
            os_version: '26.4.1',
            device_model: 'iPad Air',
            is_device: true,
            events: [
              {
                kind: 'checkpoint',
                name: 'wallet_storage_load_started',
                at: '2026-04-15T12:00:01.000Z',
                elapsed_ms: 250,
                details: {},
              },
            ],
          },
        ],
      }),
    );

    const { startupDiagnostics } = require('../startupDiagnostics');
    await startupDiagnostics.beginAttempt();
    await flushAsyncWork();

    expect(mockTrack).toHaveBeenCalledWith(
      'startup_previous_attempt_recovered',
      expect.objectContaining({
        startup_attempt_id: 'old-attempt',
        startup_status: 'abandoned',
        startup_last_event: 'app_terminated_before_startup_completed',
      }),
    );

    const raw = mockStorage.get(STORAGE_KEY);
    const parsed = JSON.parse(raw as string);
    expect(parsed.attempts).toHaveLength(2);
    expect(parsed.attempts[0].status).toBe('abandoned');
    expect(parsed.attempts[1].status).toBe('running');
    expect(parsed.attempts[1].events[0].name).toBe('attempt_started');
  });
});
