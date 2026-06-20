describe('crypto-polyfill text encoding globals', () => {
  const originalDescriptors = {};

  beforeEach(() => {
    jest.resetModules();
    for (const key of ['TextEncoder', 'TextDecoder', 'crypto', 'window']) {
      originalDescriptors[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    }

    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'TextDecoder', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: {
        getRandomValues: jest.fn((array) => array),
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    for (const [key, descriptor] of Object.entries(originalDescriptors)) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
    jest.resetModules();
  });

  it('installs working TextEncoder and TextDecoder fallbacks', () => {
    require('../crypto-polyfill');

    const encoded = new TextEncoder().encode('psbt');

    expect(Array.from(encoded)).toEqual([0x70, 0x73, 0x62, 0x74]);
    expect(new TextDecoder('utf-8').decode(encoded)).toBe('psbt');
  });
});
