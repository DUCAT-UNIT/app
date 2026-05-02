import React, { useCallback, useEffect } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { ReceiveAssetStep } from '../../components/vaultAction';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useBorrow } from '../../stores/borrowStore';

interface BorrowPayoutScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowPayoutScreen({ navigation }: BorrowPayoutScreenProps): React.JSX.Element {
  const { borrowAmountUsd, receiveAsset, setReceiveAsset, setCurrentStep } = useBorrow();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;

  useEffect(() => {
    if (!usdcFeaturesEnabled && receiveAsset !== 'UNIT') {
      setReceiveAsset('UNIT');
    }
  }, [receiveAsset, setReceiveAsset, usdcFeaturesEnabled]);

  const handleBack = useCallback(() => {
    setCurrentStep('input');
    navigation.goBack();
  }, [navigation, setCurrentStep]);

  const handleContinue = useCallback(() => {
    setCurrentStep('confirm');
    navigation.navigate('BorrowConfirm');
  }, [navigation, setCurrentStep]);

  return (
    <ReceiveAssetStep
      amountUsd={borrowAmountUsd}
      value={usdcFeaturesEnabled ? receiveAsset : 'UNIT'}
      onChange={setReceiveAsset}
      onBack={handleBack}
      onContinue={handleContinue}
      testIDPrefix="vault-borrow-payout"
      allowUsdc={usdcFeaturesEnabled}
    />
  );
}
