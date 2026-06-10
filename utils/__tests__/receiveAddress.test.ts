import { getReceiveAddressTarget } from '../receiveAddress';

const wallet = {
  segwitAddress: 'tb1qsegwit',
  taprootAddress: 'tb1ptaproot',
};

describe('getReceiveAddressTarget', () => {
  it('uses native SegWit for default BTC receive', () => {
    expect(
      getReceiveAddressTarget({
        assetType: 'BTC',
        wallet,
        walletProfile: 'xverse',
      })
    ).toEqual({
      address: 'tb1qsegwit',
      addressType: 'Native SegWit',
    });
  });

  it('uses native SegWit for UniSat BTC receive', () => {
    expect(
      getReceiveAddressTarget({
        assetType: 'BTC',
        wallet,
        walletProfile: 'unisat',
      })
    ).toEqual({
      address: 'tb1qsegwit',
      addressType: 'Native SegWit',
    });
  });

  it('uses Taproot for UNIT receive for every wallet profile', () => {
    expect(
      getReceiveAddressTarget({
        assetType: 'UNIT',
        wallet,
        walletProfile: 'unisat',
      })
    ).toEqual({
      address: 'tb1ptaproot',
      addressType: 'UNIT Address',
    });
  });
});
