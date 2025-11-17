# Taproot Fix Testing Guide

## 🎯 Testing Objective
Verify that Taproot transactions work correctly with the new safe key tweaking implementation.

## ⚠️ Prerequisites
- App built and installed on device/simulator
- Access to Mutinynet testnet
- Small amount of testnet BTC (from faucet)

---

## Test Scenarios

### Scenario 1: Taproot Address Generation ✅
**Goal**: Verify Taproot addresses are derived correctly

**Steps**:
1. Open the app
2. Create new wallet OR use existing wallet
3. Navigate to Receive screen
4. Verify Taproot address format:
   - Should start with `tb1p` (testnet Taproot)
   - Should be 62 characters long
   - Should be different from SegWit address (tb1q)

**Expected Result**: ✅ Taproot address displays correctly

**What this tests**: BIP86 derivation path and key generation

---

### Scenario 2: Receive to Taproot Address 💰
**Goal**: Verify Taproot addresses can receive funds

**Steps**:
1. Copy your Taproot address (tb1p...)
2. Send small amount from faucet OR another wallet
3. Wait for transaction to appear in app
4. Verify balance updates correctly

**Expected Result**: ✅ Funds received and balance shows correctly

**What this tests**: Address generation and monitoring

**Faucet**: https://faucet.ducatprotocol.com/btc/faucet

---

### Scenario 3: Send from Taproot (KEY-PATH) 🚀 **CRITICAL TEST**
**Goal**: Verify the fixed Taproot signing works for regular transfers

**Steps**:
1. Ensure you have balance in Taproot address
2. Go to Send screen
3. Select BTC asset
4. Enter recipient address (use SegWit tb1q... for easier verification)
5. Enter small amount (e.g., 0.0001 BTC)
6. Select Taproot as address type if prompted
7. Review transaction details
8. Confirm transaction (PIN/Biometric)
9. Wait for broadcast confirmation

**Expected Result**:
- ✅ Transaction signs successfully
- ✅ Transaction broadcasts to network
- ✅ Transaction ID returned
- ✅ Transaction appears in mempool
- ✅ Eventually confirms (check on https://mutinynet.com)

**What this tests**:
- Taproot key-path signing (the code we fixed!)
- PSBT signing with `.tweak()` method
- Transaction broadcast

**How to verify on blockchain**:
```bash
# Check transaction on explorer
https://mutinynet.com/tx/[YOUR_TXID]

# Verify inputs are Taproot (tb1p...)
# Verify signature is valid (tx confirms)
```

---

### Scenario 4: Send with Multiple Taproot UTXOs 🔄
**Goal**: Test signing multiple inputs (stress test)

**Steps**:
1. Receive multiple small amounts to Taproot address (3-5 transactions)
2. Wait for confirmations
3. Send a larger amount that requires multiple UTXOs
4. Confirm transaction

**Expected Result**:
- ✅ App selects multiple UTXOs
- ✅ All inputs signed correctly
- ✅ Transaction broadcasts successfully

**What this tests**:
- Loop signing (lines 84-86 in transactionSigningService.js)
- Multiple Taproot inputs with same tweaked key

---

### Scenario 5: Account Switching (Edge Case) 🔀
**Goal**: Test key derivation for different account indices

**Steps**:
1. Switch to Account 1 (or higher)
2. Copy Taproot address
3. Send small amount to this address
4. Try to send from this account

**Expected Result**:
- ✅ Different address generated for different accounts
- ✅ Signing works for any account index

**What this tests**:
- BIP86 path: m/86'/1'/0'/0/{accountIndex}
- Key derivation at different indices

---

### Scenario 6: Mixed Transaction (BTC + UNIT) 🎨
**Goal**: Test the UNIT transaction flow which uses mixed inputs

**Steps**:
1. Ensure you have UNIT balance
2. Send UNIT to another address
3. Transaction should use:
   - Input 0: P2WPKH (BTC for fees)
   - Input 1: Taproot (UNIT balance)

**Expected Result**:
- ✅ Both inputs signed correctly
- ✅ Transaction broadcasts
- ✅ UNIT transferred successfully

**What this tests**:
- Lines 63-75 in transactionSigningService.js
- Mixed input type signing

---

### Scenario 7: Y-Coordinate Edge Case 🎲
**Goal**: Test with addresses that have odd y-coordinate (0x03 prefix)

This is what the old dangerous code was trying to handle!

**Steps**:
1. Keep switching accounts until you find one where:
   - Taproot public key starts with 0x03 (odd y)
   - You can verify this in logs if debug logging enabled
2. Send funds to that Taproot address
3. Try to spend from it

**Expected Result**:
- ✅ Should work the same as even y-coordinate (0x02)
- ✅ No key negation errors
- ✅ Transaction signs and broadcasts

**What this tests**:
- The specific bug we fixed!
- Old code would negate the key, new code doesn't need to

**How to identify odd y-coordinate**:
- Public keys starting with 0x03 have odd y-coordinate
- Public keys starting with 0x02 have even y-coordinate
- The new code handles both correctly without special logic

---

## 🔍 Debugging Tips

### Enable Debug Logging
If you need more visibility during testing:

```javascript
// In utils/wallet.js, add logging before signing:
console.log('Signing Taproot input:', inputIndex);
console.log('Public key prefix:', keyPair.publicKey[0].toString(16));
console.log('X-only pubkey:', xOnlyPubkey.toString('hex'));
```

### Check Transaction Details
```bash
# After sending, check transaction on explorer
https://mutinynet.com/tx/[TXID]

# Look for:
# - Input addresses (should be tb1p... for Taproot)
# - Witness data (should have 64-byte Schnorr signature)
# - Transaction status (should eventually confirm)
```

### Common Issues & Solutions

**Issue**: "Can not sign for input #0 with the key..."
- **Cause**: PSBT tapInternalKey mismatch
- **Solution**: Our fallback handles this! Should work automatically
- **Verify**: Check if fallback logging appears

**Issue**: Transaction rejected by network
- **Cause**: Invalid signature (would indicate bug in fix)
- **Solution**: Check transaction hex, public key, signature
- **Verify**: Run unit tests to confirm fix is correct

**Issue**: Wrong amount sent
- **Cause**: Fee calculation issue (not related to Taproot fix)
- **Solution**: Review UTXO selection and fee calculation

---

## 📊 Success Criteria

Your fix is working correctly if:

✅ All automated tests pass (1208 tests)
✅ Can receive to Taproot address
✅ Can send from Taproot address (key-path)
✅ Transaction appears on Mutinynet explorer
✅ Transaction eventually confirms
✅ Works with both even and odd y-coordinate keys
✅ Works with multiple Taproot inputs
✅ Works across different account indices
✅ No errors in signing process

---

## 🚨 Failure Indicators

If you see any of these, the fix may have issues:

❌ "Can not sign for input" errors that don't resolve
❌ Transactions rejected by network
❌ Invalid signature errors
❌ Transactions not appearing on blockchain
❌ Different behavior between accounts
❌ Crashes during signing

---

## 🎬 Quick Test Script

For rapid testing, follow this sequence:

```bash
# 1. Install fresh build
npm run ios  # or npm run android

# 2. Create new wallet (or use existing)

# 3. Get testnet funds
# Visit: https://faucet.ducatprotocol.com/btc/faucet
# Paste your Taproot address (tb1p...)

# 4. Wait for confirmation (~10 minutes)

# 5. Send transaction
# - Amount: 0.0001 BTC
# - To: Any valid testnet address
# - Use Taproot as source

# 6. Verify on explorer
# Check: https://mutinynet.com/tx/[YOUR_TXID]
```

---

## 📝 Test Checklist

Use this checklist to track your testing:

- [ ] Unit tests pass (npm test)
- [ ] Taproot address generated correctly
- [ ] Received funds to Taproot address
- [ ] Sent transaction from Taproot (key-path)
- [ ] Transaction confirmed on blockchain
- [ ] Tested with multiple UTXOs
- [ ] Tested account switching
- [ ] Tested mixed BTC+UNIT transaction (if applicable)
- [ ] Tested with odd y-coordinate key (if found)
- [ ] No errors in console/logs

---

## 🔗 Resources

- **Mutinynet Explorer**: https://mutinynet.com
- **Testnet Faucet**: https://faucet.ducatprotocol.com/btc/faucet
- **BIP86 (Taproot)**: https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki
- **Schnorr Signatures**: https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki

---

## 💡 Understanding the Fix

**What we changed**:
- **Before**: Manual key tweaking with y-coordinate negation
- **After**: Use bitcoinjs-lib's `.tweak()` method

**Why it's safer**:
- Library handles all edge cases (odd/even y-coordinate)
- Battle-tested implementation
- Consistent with rest of codebase
- No manual BigInt math that could fail

**What to look for during testing**:
- Transactions should work the same as before
- No difference in behavior between keys with odd/even y
- Signing should be slightly faster (less computation)
- More reliable across different account indices

---

## 🎯 Next Steps After Testing

If all tests pass:
1. ✅ Mark Taproot fix as complete
2. 🔴 Move to next critical issue (HTTPS validation)
3. 📋 Document findings
4. 🚀 Prepare for testnet launch

If any tests fail:
1. 🐛 Document the failure scenario
2. 🔍 Run unit tests to narrow down issue
3. 💬 Report back with specific error messages
4. 🔧 Fix and retest

---

**Happy Testing!** 🎉
