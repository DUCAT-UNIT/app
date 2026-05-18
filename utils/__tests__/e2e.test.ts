const originalNodeEnv = process.env.NODE_ENV;
const originalJestWorkerId = process.env.JEST_WORKER_ID;

function runOutsideJest(): void {
  process.env.NODE_ENV = 'development';
  delete process.env.JEST_WORKER_ID;
}

function loadE2E(): typeof import('../e2e') {
  jest.resetModules();
  return require('../e2e') as E2EModule;
}

type E2EModule = typeof import('../e2e');

describe('e2e runtime detection', () => {
  beforeEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JEST_WORKER_ID = originalJestWorkerId;
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJestWorkerId == null) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }
    jest.resetModules();
  });

  it('does not treat development runtime as E2E by itself', () => {
    runOutsideJest();
    const e2e = loadE2E();

    expect(e2e.isE2E()).toBe(false);
  });

  it('keeps E2E helpers disabled under Jest', () => {
    process.env.NODE_ENV = 'test';
    process.env.JEST_WORKER_ID = '1';
    const e2e = loadE2E();

    expect(e2e.isE2E()).toBe(false);
  });
});
