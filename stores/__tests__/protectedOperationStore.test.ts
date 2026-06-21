import {
  selectHasProtectedOperation,
  useProtectedOperationStore,
} from '../protectedOperationStore';

describe('protectedOperationStore', () => {
  beforeEach(() => {
    useProtectedOperationStore.getState().reset();
  });

  afterEach(() => {
    useProtectedOperationStore.getState().reset();
  });

  it('tracks whether any protected operation is active', () => {
    expect(selectHasProtectedOperation(useProtectedOperationStore.getState())).toBe(false);

    useProtectedOperationStore.getState().beginOperation('turbo');
    expect(selectHasProtectedOperation(useProtectedOperationStore.getState())).toBe(true);

    useProtectedOperationStore.getState().beginOperation('vault');
    useProtectedOperationStore.getState().endOperation('turbo');
    expect(selectHasProtectedOperation(useProtectedOperationStore.getState())).toBe(true);

    useProtectedOperationStore.getState().endOperation('vault');
    expect(selectHasProtectedOperation(useProtectedOperationStore.getState())).toBe(false);
  });

  it('ignores duplicate begin and unknown end calls', () => {
    useProtectedOperationStore.getState().beginOperation('turbo');
    useProtectedOperationStore.getState().beginOperation('turbo');

    expect(useProtectedOperationStore.getState().activeOperations).toEqual({ turbo: true });

    useProtectedOperationStore.getState().endOperation('missing');
    expect(selectHasProtectedOperation(useProtectedOperationStore.getState())).toBe(true);

    useProtectedOperationStore.getState().endOperation('turbo');
    expect(selectHasProtectedOperation(useProtectedOperationStore.getState())).toBe(false);
  });
});
