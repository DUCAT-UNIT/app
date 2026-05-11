import { withVaultBuildTimeout } from '../operationTimeout';
import { withVaultOperationLock } from '../utils';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('withVaultBuildTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves when the operation finishes before the timeout', async () => {
    await expect(withVaultBuildTimeout(Promise.resolve('ok'), 'Timed out', 100)).resolves.toBe(
      'ok'
    );
  });

  it('rejects with the provided message when the operation hangs', async () => {
    jest.useFakeTimers();

    const result = withVaultBuildTimeout(
      new Promise(() => undefined),
      'Vault build timed out',
      100
    );

    jest.advanceTimersByTime(100);

    await expect(result).rejects.toThrow('Vault build timed out');
  });
});

describe('withVaultOperationLock', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects instead of waiting forever when a previous lock never releases', async () => {
    jest.useFakeTimers();

    void withVaultOperationLock(() => new Promise(() => undefined), 'stale-lock-test', 100);
    await Promise.resolve();

    const operation = jest.fn().mockResolvedValue('ok');
    const result = withVaultOperationLock(operation, 'stale-lock-test', 100);

    jest.advanceTimersByTime(100);

    await expect(result).rejects.toThrow(
      'Timed out waiting for a previous vault operation. Please try again.'
    );
    expect(operation).not.toHaveBeenCalled();
  });
});
