import {
  assertProofsMatchCashuUnit,
  assertResponseSignaturesUseExpectedKeyset,
  calculateInputFees,
  filterProofsForCashuUnit,
  findKeysetById,
  resolveResponseSignatureKeysetForUnit,
  selectActiveCashuKeyset,
} from '../cashuKeysetUtils';

describe('cashuKeysetUtils', () => {
  const keyData = {
    keysets: [
      { id: 'unit-keyset', unit: 'unit', active: true, keys: { 1: 'unit-key' } },
      { id: 'sat-keyset', unit: 'sat', active: true, keys: { 1: 'sat-key' } },
    ],
  };

  it('selects the active sat keyset when BTC Cashu is requested', () => {
    expect(selectActiveCashuKeyset(keyData, 'sat')).toEqual(
      expect.objectContaining({ id: 'sat-keyset', unit: 'sat' })
    );
  });

  it('accepts proofs from the selected Cashu unit keyset', () => {
    expect(() =>
      assertProofsMatchCashuUnit(
        [{ amount: 1, secret: 's', C: 'C', id: 'sat-keyset' }],
        keyData,
        'sat'
      )
    ).not.toThrow();
  });

  it('rejects proofs from the other Cashu unit keyset', () => {
    expect(() =>
      assertProofsMatchCashuUnit(
        [{ amount: 1, secret: 's', C: 'C', id: 'unit-keyset' }],
        keyData,
        'sat'
      )
    ).toThrow('contain unit proof in sat flow');
  });

  it('rejects unknown proof keysets', () => {
    expect(() =>
      assertProofsMatchCashuUnit(
        [{ amount: 1, secret: 's', C: 'C', id: 'missing-keyset' }],
        keyData,
        'unit'
      )
    ).toThrow('reference unknown keyset missing-keyset');
  });

  it('does not classify ambiguous keyset prefixes across units', () => {
    const ambiguousKeyData = {
      keysets: [
        { id: 'abc123', unit: 'unit', active: true, keys: { 1: 'unit-key' }, input_fee_ppk: 1000 },
        { id: 'abc456', unit: 'sat', active: true, keys: { 1: 'sat-key' }, input_fee_ppk: 1000 },
      ],
    };

    expect(findKeysetById(ambiguousKeyData, 'abc')).toBeUndefined();
    expect(() =>
      assertProofsMatchCashuUnit(
        [{ amount: 1, secret: 's', C: 'C', id: 'abc' }],
        ambiguousKeyData,
        'sat'
      )
    ).toThrow('reference unknown keyset abc');
    expect(() =>
      calculateInputFees(
        [{ amount: 1, secret: 's', C: 'C', id: 'abc' }],
        ambiguousKeyData
      )
    ).toThrow('unknown or ambiguous keyset abc');
  });

  it('filters proofs to resolvable keysets for the requested unit', () => {
    expect(
      filterProofsForCashuUnit(
        [
          { amount: 1, secret: 's1', C: 'C1', id: 'unit-keyset' },
          { amount: 1, secret: 's2', C: 'C2', id: 'sat-keyset' },
          { amount: 1, secret: 's3', C: 'C3', id: 'missing-keyset' },
        ],
        keyData,
        'unit'
      )
    ).toEqual({
      proofs: [{ amount: 1, secret: 's1', C: 'C1', id: 'unit-keyset' }],
      droppedUnknownKeyset: 1,
      droppedWrongUnit: 1,
    });
  });

  it('accepts response signatures from the requested keyset', () => {
    expect(
      assertResponseSignaturesUseExpectedKeyset(
        [{ id: 'sat-keyset' }, { id: 'sat-keyset' }],
        'sat-keyset',
        'sat swap'
      )
    ).toBe('sat-keyset');
  });

  it('rejects response signatures from the other unit keyset', () => {
    expect(() =>
      assertResponseSignaturesUseExpectedKeyset(
        [{ id: 'unit-keyset' }],
        'sat-keyset',
        'sat swap'
      )
    ).toThrow('sat swap signed with unexpected keyset unit-keyset; expected sat-keyset');
  });

  it('resolves alternate response keysets only when they belong to the same unit', () => {
    const alternateKeyData = {
      keysets: [
        ...keyData.keysets,
        { id: 'sat-keyset-next', unit: 'sat', active: true, keys: { 1: 'sat-key-next' } },
      ],
    };

    expect(
      resolveResponseSignatureKeysetForUnit(
        [{ id: 'sat-keyset-next' }],
        alternateKeyData,
        keyData.keysets[1],
        'sat',
        'sat swap'
      )
    ).toEqual({ keysetId: 'sat-keyset-next', keys: { 1: 'sat-key-next' } });

    expect(() =>
      resolveResponseSignatureKeysetForUnit(
        [{ id: 'unit-keyset' }],
        alternateKeyData,
        keyData.keysets[1],
        'sat',
        'sat swap'
      )
    ).toThrow('sat swap signed with unit keyset in sat flow');
  });
});
