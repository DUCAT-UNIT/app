#!/bin/bash

# Taproot Fix Automated Test Script
# Tests the Taproot key tweaking security fix

set -e  # Exit on any error

echo "🧪 Taproot Fix Test Suite"
echo "========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "Running: $test_name ... "

    if eval "$test_command" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((FAILED++))
        echo "  Error output:"
        tail -20 /tmp/test_output.log | sed 's/^/    /'
        return 1
    fi
}

echo "1️⃣  Running Taproot-specific tests..."
echo "-----------------------------------"
run_test "Taproot key negation tests" "npm test -- wallet.keynegation.test.js --silent"

echo ""
echo "2️⃣  Running all wallet PSBT tests..."
echo "-----------------------------------"
run_test "PSBT signing tests" "npm test -- wallet.psbt.test.js --silent"

echo ""
echo "3️⃣  Running wallet utility tests..."
echo "-----------------------------------"
run_test "Wallet utilities" "npm test -- wallet.test.js --silent"

echo ""
echo "4️⃣  Running transaction signing tests..."
echo "-----------------------------------"
run_test "Transaction signing service" "npm test -- transactionSigningService.test.js --silent"

echo ""
echo "5️⃣  Running wallet service tests..."
echo "-----------------------------------"
run_test "Wallet service" "npm test -- walletService.test.js --silent"

echo ""
echo "6️⃣  Running all wallet-related tests..."
echo "--------------------------------------"
run_test "All wallet tests" "npm test -- wallet --silent"

echo ""
echo "7️⃣  Checking for Taproot-specific code..."
echo "----------------------------------------"

# Check that dangerous y-coordinate negation is removed
if grep -r "publicKey\[0\] === 0x03" utils/wallet.js > /dev/null 2>&1; then
    echo -e "${RED}❌ FAIL: Y-coordinate negation still present in code${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}✅ PASS: Y-coordinate negation removed${NC}"
    ((PASSED++))
fi

# Check that safe .tweak() method is used
if grep -r "\.tweak(" utils/wallet.js > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: Safe .tweak() method found in code${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL: .tweak() method not found${NC}"
    ((FAILED++))
fi

# Check consistency with transactionSigningService
if diff -q <(grep -o "\.tweak(" utils/wallet.js) <(grep -o "\.tweak(" services/transactionSigningService.js) > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: Consistent tweak usage across codebase${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  INFO: Different tweak patterns (might be OK)${NC}"
fi

echo ""
echo "8️⃣  Running full test suite..."
echo "----------------------------"
run_test "Full test suite" "npm test -- --silent --maxWorkers=4"

echo ""
echo "================================"
echo "📊 Test Results Summary"
echo "================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Taproot fix is working correctly.${NC}"
    echo ""
    echo "✅ Safe to proceed with manual testing on testnet"
    echo "📖 See TAPROOT_TESTING_GUIDE.md for manual testing instructions"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the errors above.${NC}"
    echo ""
    echo "🔍 To debug:"
    echo "  1. Check /tmp/test_output.log for detailed error messages"
    echo "  2. Run failing tests individually: npm test -- <test-name>"
    echo "  3. Review changes in utils/wallet.js"
    echo ""
    exit 1
fi
