import { NavigationProp } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { ReceiveAssetStep } from '../../components/vaultAction';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { resolveVaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';
import { useVaultCreation } from '../../stores/vaultCreationStore';

interface VaultPayoutScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function VaultPayoutScreen({ navigation }: VaultPayoutScreenProps): React.JSX.Element {
  const { borrowAmountUsd, receiveAsset, setReceiveAsset, setCurrentStep } = useVaultCreation();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const effectiveReceiveAsset = resolveVaultSettlementRequestedAsset(receiveAsset, usdcFeaturesEnabled);

  useEffect(() => {
    if (receiveAsset !== effectiveReceiveAsset) {
      setReceiveAsset('UNIT');
    }
  }, [effectiveReceiveAsset, receiveAsset, setReceiveAsset]);

  const handleBack = useCallback(() => {
    setCurrentStep('amounts');
    navigation.goBack();
  }, [navigation, setCurrentStep]);

  const handleContinue = useCallback(() => {
    setCurrentStep('confirm');
    navigation.navigate('VaultConfirm');
  }, [navigation, setCurrentStep]);

  return (
    <ReceiveAssetStep
      amountUsd={borrowAmountUsd}
      value={effectiveReceiveAsset}
      onChange={setReceiveAsset}
      onBack={handleBack}
      onContinue={handleContinue}
      testIDPrefix="vault-create-payout"
      allowUsdc={usdcFeaturesEnabled}
      allowTurboUnit
    />
  );
}
