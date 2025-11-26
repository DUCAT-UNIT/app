#!/bin/bash

# Script to fix TypeScript errors in test files

# Find all test files
TEST_FILES=$(find services -name "*.test.ts" 2>/dev/null)

for file in $TEST_FILES; do
  echo "Processing $file..."

  # Create backup
  cp "$file" "$file.bak"

  # Fix global.* to (global as any).*
  sed -i '' 's/global\.fetch/((global as any).fetch/g' "$file"
  sed -i '' 's/global\.atob/((global as any).atob/g' "$file"
  sed -i '' 's/\bdelete global\./delete (global as any)./g' "$file"
  sed -i '' 's/\bglobal\.processedCashuTokens/(global as any).processedCashuTokens/g' "$file"
  sed -i '' 's/\bglobal\.processedCashuTokensLoading/(global as any).processedCashuTokensLoading/g' "$file"
  sed -i '' 's/\bglobal\.pendingCashuToken/(global as any).pendingCashuToken/g' "$file"
  sed -i '' 's/\bglobal\.pendingTurboSnackbars/(global as any).pendingTurboSnackbars/g' "$file"
  sed -i '' 's/\bglobal\.turboJustResumed/(global as any).turboJustResumed/g' "$file"

  # Remove backup if successful
  if [ $? -eq 0 ]; then
    rm "$file.bak"
  else
    echo "Error processing $file, restoring backup"
    mv "$file.bak" "$file"
  fi
done

echo "Done!"
