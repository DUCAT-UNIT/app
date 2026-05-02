import { dismissVaultActionFlow } from '../navigation';

type MockNavigation = {
  dispatch: jest.Mock;
  goBack: jest.Mock;
  canGoBack: jest.Mock;
  getParent: jest.Mock;
  getState: jest.Mock;
};

function createNavigation(overrides: Partial<MockNavigation> = {}): MockNavigation {
  return {
    dispatch: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => false),
    getParent: jest.fn(() => undefined),
    getState: jest.fn(() => ({ index: 0, routes: [] })),
    ...overrides,
  };
}

describe('vault navigation helpers', () => {
  it('pops the active root vault action flow instead of only going back in the child stack', () => {
    const rootNavigation = createNavigation({
      canGoBack: jest.fn(() => true),
      getState: jest.fn(() => ({
        index: 1,
        routes: [{ name: 'Main' }, { name: 'BorrowFlow' }],
      })),
    });
    const childNavigation = createNavigation({
      getParent: jest.fn(() => rootNavigation),
    });

    dismissVaultActionFlow(childNavigation as never);

    expect(rootNavigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'POP',
        payload: { count: 1 },
      }),
    );
    expect(childNavigation.goBack).not.toHaveBeenCalled();
  });

  it('walks up nested parents until it finds the root vault action flow', () => {
    const rootNavigation = createNavigation({
      getState: jest.fn(() => ({
        index: 1,
        routes: [{ name: 'Main' }, { name: 'RepayFlow' }],
      })),
    });
    const flowNavigation = createNavigation({
      getState: jest.fn(() => ({
        index: 0,
        routes: [{ name: 'RepayInput' }],
      })),
      getParent: jest.fn(() => rootNavigation),
    });
    const screenNavigation = createNavigation({
      getParent: jest.fn(() => flowNavigation),
    });

    dismissVaultActionFlow(screenNavigation as never);

    expect(rootNavigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'POP',
        payload: { count: 1 },
      }),
    );
  });

  it('falls back to parent goBack when no vault action flow route is active', () => {
    const parentNavigation = createNavigation({
      canGoBack: jest.fn(() => true),
      getState: jest.fn(() => ({
        index: 0,
        routes: [{ name: 'Main' }],
      })),
    });
    const childNavigation = createNavigation({
      getParent: jest.fn(() => parentNavigation),
    });

    dismissVaultActionFlow(childNavigation as never);

    expect(parentNavigation.goBack).toHaveBeenCalled();
  });
});
