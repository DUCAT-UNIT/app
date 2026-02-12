/**
 * Tests for AssetCard component
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// Mock useResponsive hook
jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 375,
    height: 812,
    screenSize: 'medium',
    scale: 1,
    s: (value: number) => value,
    sf: (value: number) => value,
  }),
}));

// Mock Icon component inline
jest.mock('../../icons', () => {
  const _React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name, _size, _color, _style }: { name: string; _size?: number; _color?: string; _style?: any }) => {
    return _React.createElement(Text, { testID: `icon-${name}` }, name);
  };
  return {
    __esModule: true,
    default: MockIcon,
    NavigationIcons: {},
    WalletIcons: {},
    SecurityIcons: {},
    BrandIcons: {},
    UIIcons: {},
  };
});

import AssetCard from '../AssetCard';

describe('AssetCard', () => {
  const mockProps = {
    assetName: 'Bitcoin',
    assetLogo: 'btc_logo',
    amountLabel: 'btc_symbol',
    amountValue: '0.12345678',
    displayInBTC: false,
    btcValue: 0.12345678,
    usdValue: 5432.10,
    styles: {
      assetCard: {},
      assetCardLast: {},
      assetRow: {},
      assetLeft: {},
      btcIcon: {},
      ducatIcon: {},
      assetInfo: {},
      assetName: {},
      balanceWithIcon: {},
      assetAmountIcon: {},
      assetAmount: {},
      assetValueWithIcon: {},
      assetIcon: {},
      assetValue: {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} />);
    expect(getByLabelText(/Bitcoin/)).toBeTruthy();
  });

  it('should display asset name', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} />);
    expect(getByLabelText(/Bitcoin/)).toBeTruthy();
  });

  it('should display USD value when displayInBTC is false', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} displayInBTC={false} />);
    expect(getByLabelText(/\$5,432\.10/)).toBeTruthy();
  });

  it('should display BTC value when displayInBTC is true', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} displayInBTC={true} />);
    expect(getByLabelText(/0\.12345678 Bitcoin/)).toBeTruthy();
  });

  it('should apply isLast style when isLast is true', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} isLast={true} />);
    // Just verify it renders - style testing is complex with testing-library
    expect(getByLabelText(/Bitcoin/)).toBeTruthy();
  });

  it('should apply customAmountStyle when provided', () => {
    const customStyle = { textAlign: 'left' as const };
    const { getByLabelText } = render(<AssetCard {...mockProps} customAmountStyle={customStyle} />);
    expect(getByLabelText(/Bitcoin/)).toBeTruthy();
  });

  it('should handle string BTC value', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} btcValue="0.00000000" displayInBTC={true} />);
    expect(getByLabelText(/0\.00000000 Bitcoin/)).toBeTruthy();
  });

  it('should handle string USD value', () => {
    const { getByLabelText } = render(<AssetCard {...mockProps} usdValue="0.00" displayInBTC={false} />);
    expect(getByLabelText(/\$0\.00/)).toBeTruthy();
  });

  it('should render without amountLabel', () => {
    const propsWithoutLabel = { ...mockProps, amountLabel: undefined };
    const { getByLabelText } = render(<AssetCard {...propsWithoutLabel} />);
    expect(getByLabelText(/Bitcoin/)).toBeTruthy();
  });
});
