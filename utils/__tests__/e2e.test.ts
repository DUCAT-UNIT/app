type E2EModule = typeof import('../e2e');

const originalNodeEnv = process.env.NODE_ENV;
const originalJestWorkerId = process.env.JEST_WORKER_ID;
const originalConfiguredBypass = process.env.EXPO_PUBLIC_E2E_BYPASS;

function runOutsideJest(): void {
  process.env.NODE_ENV = 'development';
  delete process.env.JEST_WORKER_ID;
}

function loadE2E(extra: Record<string, unknown> = {}): E2EModule {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: {
      expoConfig: {
        extra,
      },
    },
  }));

  return require('../e2e') as E2EModule;
}

describe('e2e bypass detection', () => {
  beforeEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JEST_WORKER_ID = originalJestWorkerId;
    delete process.env.EXPO_PUBLIC_E2E_BYPASS;
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJestWorkerId == null) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }
    if (originalConfiguredBypass == null) {
      delete process.env.EXPO_PUBLIC_E2E_BYPASS;
    } else {
      process.env.EXPO_PUBLIC_E2E_BYPASS = originalConfiguredBypass;
    }
    jest.dontMock('expo-constants');
    jest.resetModules();
  });

  it('does not treat development runtime as E2E by itself', () => {
    runOutsideJest();
    const e2e = loadE2E();

    expect(e2e.hasConfiguredE2EBypass()).toBe(false);
    expect(e2e.hasActiveE2EBypass()).toBe(false);
    expect(e2e.isE2E()).toBe(false);

    e2e.enableRuntimeE2EBypass();

    expect(e2e.hasActiveE2EBypass()).toBe(false);
    expect(e2e.isE2E()).toBe(false);
  });

  it('enables E2E when the bypass environment variable is explicit', () => {
    runOutsideJest();
    process.env.EXPO_PUBLIC_E2E_BYPASS = 'true';
    const e2e = loadE2E();

    expect(e2e.hasConfiguredE2EBypass()).toBe(true);
    expect(e2e.hasActiveE2EBypass()).toBe(true);
    expect(e2e.isE2E()).toBe(true);
  });

  it('enables E2E when Expo config explicitly carries the bypass flag', () => {
    runOutsideJest();
    const e2e = loadE2E({ e2eBypass: true });

    expect(e2e.hasConfiguredE2EBypass()).toBe(true);
    expect(e2e.isE2E()).toBe(true);
  });

  it('keeps isE2E disabled under Jest even when bypass is configured', () => {
    process.env.NODE_ENV = 'test';
    process.env.JEST_WORKER_ID = '1';
    process.env.EXPO_PUBLIC_E2E_BYPASS = 'true';
    const e2e = loadE2E();

    expect(e2e.hasActiveE2EBypass()).toBe(true);
    expect(e2e.isE2E()).toBe(false);
  });
});
