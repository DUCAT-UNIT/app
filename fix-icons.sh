#!/bin/bash

# Script to add type annotations to all icon component files

# Add type annotations to BrandIcons
sed -i '' 's/unit_logo: ({ width, height })/unit_logo: ({ width, height }: { width?: number; height?: number })/g' components/icons/BrandIcons.tsx
sed -i '' 's/btc_logo: ({ width, height })/btc_logo: ({ width, height }: { width?: number; height?: number })/g' components/icons/BrandIcons.tsx
sed -i '' 's/ducat_logo: ({ width, height })/ducat_logo: ({ width, height }: { width?: number; height?: number })/g' components/icons/BrandIcons.tsx
sed -i '' 's/btc_symbol: ({ width, height, color = '\''#DDDDDD'\'' })/btc_symbol: ({ width, height, color = '\''#DDDDDD'\'' }: { width?: number; height?: number; color?: string })/g' components/icons/BrandIcons.tsx
sed -i '' 's/unit_symbol: ({ width, height, color = '\''#DDDDDD'\'' })/unit_symbol: ({ width, height, color = '\''#DDDDDD'\'' }: { width?: number; height?: number; color?: string })/g' components/icons/BrandIcons.tsx
sed -i '' 's/vault_logo: ({ width, height, color = '\''#DDDDDD'\'' })/vault_logo: ({ width, height, color = '\''#DDDDDD'\'' }: { width?: number; height?: number; color?: string })/g' components/icons/BrandIcons.tsx
sed -i '' 's/qr_code: ({ width, height, color = '\''#DDDDDD'\'' })/qr_code: ({ width, height, color = '\''#DDDDDD'\'' }: { width?: number; height?: number; color?: string })/g' components/icons/BrandIcons.tsx

echo "Icon type annotations added successfully"
