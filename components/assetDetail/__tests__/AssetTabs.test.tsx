import React from 'react';
import { act, create } from 'react-test-renderer';
import { AssetTabs } from '../AssetTabs';

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    s: (value: number) => value,
    sf: (value: number) => value,
  }),
}));

describe('AssetTabs', () => {
  it.each(['BTC', 'UNIT'] as const)('does not expose a separate Turbo tab for %s', (assetType) => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(
        <AssetTabs selectedTab="ACTIVITY" onTabChange={jest.fn()} assetType={assetType} />
      );
    });

    expect(tree!.root.findAllByProps({ testID: 'asset-tab-activity' })).toHaveLength(1);
    expect(tree!.root.findAllByProps({ testID: 'asset-tab-about' })).toHaveLength(1);
    expect(tree!.root.findAllByProps({ testID: 'asset-tab-turbo' })).toHaveLength(0);
  });
});
