import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PinFallbackModal from '../auth/PinFallbackModal';

jest.mock('../icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return {
    __esModule: true,
    default: MockIcon,
  };
});

describe('PinFallbackModal', () => {
  it('submits the PIN after six digits are entered', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <PinFallbackModal visible onSubmit={onSubmit} onCancel={jest.fn()} />
    );

    ['1', '2', '3', '4', '5', '6'].forEach((digit) => {
      fireEvent.press(getByTestId(`pin-fallback-key-${digit}`));
    });

    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  it('does not render when hidden', () => {
    const { queryByTestId } = render(
      <PinFallbackModal visible={false} onSubmit={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByTestId('pin-fallback-modal')).toBeNull();
  });
});
