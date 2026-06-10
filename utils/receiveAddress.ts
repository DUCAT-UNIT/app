import type { WalletAddresses } from '../contexts/WalletContext';
import type { WalletImportProfile } from '../constants/bitcoin';

export type ReceiveAssetType = 'BTC' | 'UNIT';

export interface ReceiveAddressTarget {
  address: string | undefined;
  addressType: string;
}

interface GetReceiveAddressTargetParams {
  assetType: ReceiveAssetType;
  wallet: Pick<WalletAddresses, 'segwitAddress' | 'taprootAddress'> | null | undefined;
  walletProfile: WalletImportProfile;
}

export function getReceiveAddressTarget({
  assetType,
  wallet,
}: GetReceiveAddressTargetParams): ReceiveAddressTarget {
  if (assetType === 'UNIT') {
    return {
      address: wallet?.taprootAddress,
      addressType: 'UNIT Address',
    };
  }

  return {
    address: wallet?.segwitAddress,
    addressType: 'Native SegWit',
  };
}
