import { withTimeout } from '../withTimeout';
import { startupDiagnostics } from '../../services/startupDiagnostics';
import { logger } from '../logger';

jest.mock('../../services/startupDiagnostics', () => ({
  startupDiagnostics: {
    getCurrentAttemptId: jest.fn(() => 'attempt-1'),
    recordWarning: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockStartupDiagnostics = startupDiagnostics as jest.Mocked<typeof startupDiagnostics>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('withTimeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the promise result when it resolves before the timeout', async () => {
    const result = withTimeout(Promise.resolve('ok'), 100, 'fallback', 'fast-call');

    await expect(result).resolves.toBe('ok');
    expect(mockStartupDiagnostics.recordWarning).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('returns the fallback and records diagnostics when the timeout fires', async () => {
    const never = new Promise<string>(() => undefined);
    const result = withTimeout(never, 250, 'fallback', 'slow-native-api');

    jest.advanceTimersByTime(250);

    await expect(result).resolves.toBe('fallback');
    expect(mockStartupDiagnostics.recordWarning).toHaveBeenCalledWith('native_api_timeout', {
      label: 'slow-native-api',
      timeout_ms: 250,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[withTimeout] slow-native-api timed out after 250ms, using fallback',
    );
  });

  it('returns the fallback without diagnostics when no label is provided', async () => {
    const never = new Promise<number>(() => undefined);
    const result = withTimeout(never, 10, 42);

    jest.advanceTimersByTime(10);

    await expect(result).resolves.toBe(42);
    expect(mockStartupDiagnostics.recordWarning).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
