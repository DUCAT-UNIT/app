/**
 * Test Utilities
 * Common testing utilities for service tests
 */

export {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
  createMockTextResponse,
  mockFetchSuccess,
  mockFetchSuccessSequence,
  mockFetchError,
  mockFetchReject,
  mockFetchImplementation,
  clearMockFetch,
  getFetchCallCount,
  getFetchCall,
  expectFetchCalledWithUrl,
  getFetchCallBody,
  expectFetchNotCalled,
} from './fetchMock';

export {
  renderHook,
  assertHookResult,
  getHookResult,
  type RenderHookResult,
  type RenderHookOptions,
} from './renderHook';

export {
  asMock,
  asMockedHook,
  createMock,
  setMockReturnValue,
  setMockResolvedValue,
  setMockRejectedValue,
  getMockCalls,
  getLastMockCall,
  expectMockCalledWith,
  clearMock,
  resetMock,
  type MockFunction,
  type MockedFunction,
} from './mockHelpers';

export { makeDerivedAddresses, makeWalletAccountAddresses } from './walletFactories';
