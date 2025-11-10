/**
 * Simple test script for address validation
 * Run with: node app/test-address-validation.js
 */

import { validateBitcoinAddress, validateAndNormalizeAddress } from './utils/bitcoin.js';

const testCases = [
  // Valid testnet addresses
  { address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', expected: true, type: 'segwit', description: 'Valid testnet SegWit (P2WPKH)' },
  { address: 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297', expected: true, type: 'taproot', description: 'Valid testnet Taproot (P2TR)' },
  { address: '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc', expected: true, type: 'legacy', description: 'Valid testnet P2SH' },
  { address: 'n1ZCYg9YXtB5XCZazLxSmPDa8iwJRZHhGx', expected: true, type: 'legacy', description: 'Valid testnet P2PKH' },

  // Valid addresses with whitespace (should pass after trimming)
  { address: '  tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx  ', expected: true, type: 'segwit', description: 'SegWit with whitespace' },

  // Invalid addresses
  { address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', expected: false, description: 'Mainnet address (should reject)' },
  { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', expected: false, description: 'Mainnet P2PKH (should reject)' },
  { address: '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy', expected: false, description: 'Mainnet P2SH (should reject)' },
  { address: 'invalid_address', expected: false, description: 'Invalid format' },
  { address: '', expected: false, description: 'Empty string' },
  { address: 'tb1qinvalidchars!!@@', expected: false, description: 'Invalid characters' },
  { address: 'tb1q', expected: false, description: 'Too short' },
];

console.log('='.repeat(80));
console.log('BITCOIN ADDRESS VALIDATION TESTS');
console.log('='.repeat(80));
console.log('');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  try {
    const result = validateBitcoinAddress(test.address);
    const success = result.valid === test.expected;

    if (success) {
      passed++;
      console.log('✅ Test ' + (index + 1) + ': ' + test.description);
      if (result.valid) {
        console.log('   Address: ' + test.address.trim());
        console.log('   Type: ' + result.type);
      } else {
        console.log('   Error: ' + result.error);
      }
    } else {
      failed++;
      console.log('❌ Test ' + (index + 1) + ': ' + test.description);
      console.log('   Expected: ' + test.expected + ', Got: ' + result.valid);
      console.log('   Address: ' + test.address);
      if (result.error) console.log('   Error: ' + result.error);
    }
    console.log('');
  } catch (error) {
    failed++;
    console.log('❌ Test ' + (index + 1) + ': ' + test.description + ' - EXCEPTION');
    console.log('   Address: ' + test.address);
    console.log('   Error: ' + error.message);
    console.log('');
  }
});

console.log('='.repeat(80));
console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed out of ' + testCases.length + ' tests');
console.log('='.repeat(80));

if (failed === 0) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed!');
  process.exit(1);
}
