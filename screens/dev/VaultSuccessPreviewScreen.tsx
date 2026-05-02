import React, { useCallback } from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import VaultActionSuccess, { buildVaultSuccessTxItems } from '../../components/vault/VaultActionSuccess';
import type { RootNavigatorParamList } from '../../navigation/types';

type VaultSuccessPreviewScreenProps = StackScreenProps<
  RootNavigatorParamList,
  'VaultSuccessPreview'
>;

export default function VaultSuccessPreviewScreen({
  navigation,
}: VaultSuccessPreviewScreenProps): React.JSX.Element {
  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <VaultActionSuccess
      actionType="create"
      amount={1059.12}
      usdValue={1059.12}
      txid="bf314baa779b7792891f0b8fe5800a79d7b917cba470e25905f31"
      unit="USDC"
      titleOverride="Vault Created!"
      messageOverride="BTC collateral is locked and the issued UNIT settled to Sepolia USDC."
      txItems={buildVaultSuccessTxItems({
        mutinynetTxid: 'bf314baa779b7792891f0b8fe5800a79d7b917cba470e25905f31',
        sepoliaTxHash: '0x28873c4808ed70ac8dff4b9d1bd0ffad5e0894e93a0f6e75fcbee447ee66cb20',
        includeSepolia: true,
      })}
      onDone={handleDone}
    />
  );
}
