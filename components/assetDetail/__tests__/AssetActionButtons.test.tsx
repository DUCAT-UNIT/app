import React from 'react';
import { render } from '@testing-library/react-native';
import { AssetActionButtons } from '../AssetActionButtons';

jest.mock('../../icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return {
    __esModule: true,
    default: MockIcon,
  };
});

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    s: (value: number) => value,
    sf: (value: number) => value,
  }),
}));

describe('AssetActionButtons', () => {
  it('labels the Turbo melt action as Redeem', () => {
    const { getByText, getByTestId, queryByText } = render(
      <AssetActionButtons
        onSendPress={jest.fn()}
        onReceivePress={jest.fn()}
        onConsolidatePress={jest.fn()}
        showConsolidate
      />
    );

    expect(getByTestId('asset-detail-withdraw-turbo-btn')).toBeTruthy();
    expect(getByText('Redeem')).toBeTruthy();
    expect(queryByText('Withdraw')).toBeNull();
  });
});
