jest.unmock('../logger');

const originalDev = (global as Record<string, unknown>).__DEV__;

describe('logger redaction', () => {
  let testLogger: typeof import('../logger').logger;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    (global as Record<string, unknown>).__DEV__ = true;
    testLogger = require('../logger').logger;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    (global as Record<string, unknown>).__DEV__ = originalDev;
  });

  it('redacts sensitive fields recursively for info logs', () => {
    testLogger.info('sensitive context', {
      mnemonic: 'abandon abandon abandon',
      nested: {
        privateKey: 'deadbeef',
        proofs: [{ secret: 'proof-secret', amount: 1 }],
      },
      tokenLength: 123,
      safe: 'visible',
    });

    expect(logSpy).toHaveBeenCalledWith('[INFO] sensitive context', {
      mnemonic: '[REDACTED]',
      nested: {
        privateKey: '[REDACTED]',
        proofs: '[REDACTED]',
      },
      tokenLength: 123,
      safe: 'visible',
    });
  });

  it('redacts sensitive direct debug arguments and payload shapes', () => {
    testLogger.debug('qr payload', 'cashuB-secret-token', {
      psbt: 'cHNidP8BAHECAAAAA',
      rawtx: 'a'.repeat(140),
      tokenLength: 17,
    });

    expect(logSpy).toHaveBeenCalledWith('[DEBUG] qr payload', '[REDACTED]', {
      psbt: '[REDACTED]',
      rawtx: '[REDACTED]',
      tokenLength: 17,
    });
  });

  it('redacts error messages and context in error logs', () => {
    testLogger.error(new Error('cashuB-secret-token'), {
      seed: 'seed phrase',
      address: 'tb1pvisible',
    });

    expect(warnSpy).toHaveBeenCalledWith('[ERROR]', {
      name: 'Error',
      message: '[REDACTED]',
    }, {
      seed: '[REDACTED]',
      address: 'tb1pvisible',
    });
  });
});
