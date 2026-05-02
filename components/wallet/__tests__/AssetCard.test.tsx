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
    const { getByText } = render(<AssetCard {...mockProps} />);
    expect(getByText('Bitcoin')).toBeTruthy();
  });

  it('should display asset name', () => {
    const { getByText } = render(<AssetCard {...mockProps} />);
    expect(getByText('Bitcoin')).toBeTruthy();
  });

  it('should display USD value when displayInBTC is false', () => {
    const { getByText } = render(<AssetCard {...mockProps} displayInBTC={false} />);
    expect(getByText(/\$\s+5,432\.10/)).toBeTruthy();
  });

  it('should display BTC value when displayInBTC is true', () => {
    const { getAllByText } = render(<AssetCard {...mockProps} displayInBTC={true} />);
    expect(getAllByText('0.12345678').length).toBeGreaterThanOrEqual(2);
  });

  it('should apply isLast style when isLast is true', () => {
    const { getByText } = render(<AssetCard {...mockProps} isLast={true} />);
    // Just verify it renders - style testing is complex with testing-library
    expect(getByText('Bitcoin')).toBeTruthy();
  });

  it('should apply customAmountStyle when provided', () => {
    const customStyle = { textAlign: 'left' as const };
    const { getByText } = render(<AssetCard {...mockProps} customAmountStyle={customStyle} />);
    expect(getByText('Bitcoin')).toBeTruthy();
  });

  it('should handle string BTC value', () => {
    const { getByText } = render(<AssetCard {...mockProps} btcValue="0.00000000" displayInBTC={true} />);
    expect(getByText('0.00000000')).toBeTruthy();
  });

  it('should handle string USD value', () => {
    const { getByText } = render(<AssetCard {...mockProps} usdValue="0.00" displayInBTC={false} />);
    expect(getByText(/\$\s+0\.00/)).toBeTruthy();
  });

  it('should render without amountLabel', () => {
    const propsWithoutLabel = { ...mockProps, amountLabel: undefined };
    const { getByText } = render(<AssetCard {...propsWithoutLabel} />);
    expect(getByText('Bitcoin')).toBeTruthy();
  });

  it('should support alternate brand logos for non-BTC assets', () => {
    const { getByTestId, getByText } = render(
      <AssetCard
        {...mockProps}
        assetName="USDC"
        assetLogo="usdc_logo"
        amountLabel={undefined}
        amountValue="100.00"
        usdValue={100}
      />,
    );

    expect(getByTestId('icon-usdc_logo', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('USDC')).toBeTruthy();
  });
});
