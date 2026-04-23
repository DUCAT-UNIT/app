import React, { useCallback } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { ReceiveAssetStep } from '../../components/vaultAction';
import { useBorrow } from '../../stores/borrowStore';

interface BorrowPayoutScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function BorrowPayoutScreen({ navigation }: BorrowPayoutScreenProps): React.JSX.Element {
  const { borrowAmountUsd, receiveAsset, setReceiveAsset, setCurrentStep } = useBorrow();

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
      value={receiveAsset}
      onChange={setReceiveAsset}
      onBack={handleBack}
      onContinue={handleContinue}
      testIDPrefix="vault-borrow-payout"
    />
  );
}
