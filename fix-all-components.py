#!/usr/bin/env python3
"""
Comprehensive script to add TypeScript type annotations to all component files
"""

import re
import os
from pathlib import Path

# Mapping of files to their props interfaces
COMPONENT_INTERFACES = {
    'assetDetail/AssetAbout.tsx': '''interface AssetAboutProps {
  assetType: string;
}

export function AssetAbout({ assetType }: AssetAboutProps)''',

    'assetDetail/AssetActionButtons.tsx': '''interface AssetActionButtonsProps {
  onSendPress: () => void;
  onReceivePress: () => void;
  onConsolidatePress: () => void;
  onTurboPress: () => void;
  showConsolidate: boolean;
}

export function AssetActionButtons({ onSendPress, onReceivePress, onConsolidatePress, onTurboPress, showConsolidate }: AssetActionButtonsProps)''',

    'assetDetail/AssetActivityList.tsx': '''interface AssetActivityListProps {
  transactions: any[];
  isLoading: boolean;
  onTransactionPress: (tx: any) => void;
  advancedMode: boolean;
}

export function AssetActivityList({ transactions, isLoading, onTransactionPress, advancedMode }: AssetActivityListProps)''',

    'assetDetail/AssetHeader.tsx': '''interface AssetHeaderProps {
  onBackPress: () => void;
}

export function AssetHeader({ onBackPress }: AssetHeaderProps)''',

    'assetDetail/AssetInfo.tsx': '''interface AssetInfoProps {
  assetType: string;
  balance: number;
  fiatValue: number;
  btcPrice: number;
  priceData: any;
  priceDirection: string;
  isLoading: boolean;
}

export function AssetInfo({ assetType, balance, fiatValue, btcPrice, priceData, priceDirection, isLoading }: AssetInfoProps)''',

    'assetDetail/AssetTabs.tsx': '''interface AssetTabsProps {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  assetType: string;
}

export function AssetTabs({ selectedTab, onTabChange, assetType }: AssetTabsProps)''',

    'BottomNavigationBar.tsx': '''interface BottomNavigationBarProps {
  activeTab: string;
  onVaultPress: () => void;
  onWalletPress: () => void;
}

export default function BottomNavigationBar({ activeTab, onVaultPress, onWalletPress }: BottomNavigationBarProps)''',

    'charts/PriceChart.tsx': '''interface PriceChartProps {
  data: any[];
  isPositive: boolean;
  minBoundary?: number;
  maxBoundary?: number;
}

export const PriceChart = React.memo(({ data, isPositive, minBoundary, maxBoundary }: PriceChartProps)''',

    'common/BottomSheet.tsx': '''interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps)''',

    'common/TouchableScale.tsx': '''interface TouchableScaleProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  disabled?: boolean;
}

export function TouchableScale({ children, onPress, style, disabled }: TouchableScaleProps)''',

    'ecash/LowEcashBalanceModal.tsx': '''interface LowEcashBalanceModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentBalance: number;
  defaultThreshold: number;
  amountNeeded: number;
}

export function LowEcashBalanceModal({ visible, onClose, onConfirm, currentBalance, defaultThreshold, amountNeeded }: LowEcashBalanceModalProps)''',

    'ecash/TokenDetailsSheet.tsx': '''interface TokenDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  recipientAddress: string;
  shortUrl: string;
  cashuToken: string;
  onCopy: (text: string, message: string) => void;
}

export function TokenDetailsSheet({ visible, onClose, recipientAddress, shortUrl, cashuToken, onCopy }: TokenDetailsSheetProps)''',
}

def add_interface_to_file(file_path, component_name):
    """Add TypeScript interface to a specific component file"""
    if component_name not in COMPONENT_INTERFACES:
        return False

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        interface_code = COMPONENT_INTERFACES[component_name]

        # Find the function declaration pattern
        # Pattern 1: export function ComponentName({
        pattern1 = r'(export (?:default )?function \w+\(\{[^\}]+\}\))'

        # Pattern 2: export const ComponentName = React.memo(({
        pattern2 = r'(export const \w+ = React\.memo\(\(\{[^\}]+\}\))'

        # Check if already has types
        if '}: {' in content or '}: ' + component_name.split('/')[-1].replace('.tsx', '') + 'Props' in content:
            return False

        # Replace the function declaration with the typed version
        if 'export function' in interface_code:
            # Find the function name from the interface
            func_match = re.search(r'export function (\w+)\([^)]+\)', interface_code)
            if func_match:
                func_name = func_match.group(1)
                old_pattern = f'export function {func_name}\\(\\{{([^}}]+)\\}}\\)'
                new_code = interface_code
                content = re.sub(old_pattern, lambda m: new_code, content, count=1)

                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return True

        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function"""
    components_dir = Path('components')

    if not components_dir.exists():
        print("components directory not found")
        return

    fixed_count = 0
    for component_name, interface_code in COMPONENT_INTERFACES.items():
        file_path = components_dir / component_name
        if file_path.exists():
            if add_interface_to_file(file_path, component_name):
                print(f"Fixed: {file_path}")
                fixed_count += 1
        else:
            print(f"Not found: {file_path}")

    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == '__main__':
    main()
