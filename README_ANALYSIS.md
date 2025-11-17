# DUCAT Bitcoin Wallet - Comprehensive Codebase Analysis

This directory contains three comprehensive analysis documents for the DUCAT Bitcoin wallet application. These documents provide complete reference material for understanding the codebase structure, security architecture, and deployment requirements.

## Analysis Documents

### 1. CODEBASE_ANALYSIS.md (34 KB)
**The most comprehensive reference document**

Complete architectural breakdown including:
- Executive summary and project overview
- Full directory structure (260+ files)
- All 50+ dependencies with purpose
- 13 contexts and state management explained
- 39 custom hooks documented
- 15 screens mapped with functionality
- 45+ components cataloged
- 20+ services with details
- Bitcoin integration (BIP84/BIP86, PSBT, Runes)
- Security architecture (PIN, biometric, passkey, iCloud)
- Data flow examples (onboarding, send, balance updates)
- Testing infrastructure overview
- Constants and configuration details
- 15+ deployment recommendations
- Architecture diagrams and patterns

**Use this for:** Deep understanding, security audits, architectural decisions

### 2. CODEBASE_SUMMARY.md (9 KB)
**Quick reference guide for daily development**

Quick lookup information:
- Project statistics
- Directory structure
- Technology stack summary
- Architecture hierarchy
- Navigation stack overview
- Security architecture summary
- Bitcoin integration overview
- Key files quick lookup (organized by category)
- Common tasks and how-tos
- Critical security patterns
- Deployment checklist
- Performance targets
- Common issues and solutions
- Testing commands
- Useful resources

**Use this for:** Quick reference, onboarding, common tasks

### 3. CRITICAL_PATHS.md (13 KB)
**Complete file path directory**

Organized file listing by category:
- Core application files
- Security-critical files (8 flagged)
- Bitcoin core files (9 flagged)
- 13 context files listed
- 15 screen files with descriptions
- 23+ component files with purposes
- 39 hook files organized by function
- 20+ service files cataloged
- Utility files documented
- All constants files listed
- Navigation files detailed
- Test files and configuration
- Theme and styling files
- Asset files listed
- File path lookup by feature

**Use this for:** Navigation, finding specific files, understanding file organization

## Quick Navigation

### If you need to understand...

**Bitcoin Transaction Signing:**
1. Read: CODEBASE_ANALYSIS.md → Section 4 (Bitcoin Integration)
2. Files: /services/transactionSigningService.js, /utils/wallet.js

**Security Architecture:**
1. Read: CODEBASE_ANALYSIS.md → Section 6 (Security Considerations)
2. Files: /services/pinService.js, /services/passkeyService.js, /constants/security.js

**App State Management:**
1. Read: CODEBASE_ANALYSIS.md → Section 3 (Architecture Patterns)
2. Quick ref: CODEBASE_SUMMARY.md → Architecture section
3. Files: All files in /contexts/

**Adding a New Feature:**
1. Read: CODEBASE_SUMMARY.md → Common Tasks
2. Navigate files: CRITICAL_PATHS.md → File Path by Feature

**Deployment & Production:**
1. Read: CODEBASE_ANALYSIS.md → Section 11 (Deployment Considerations)
2. Check: CODEBASE_SUMMARY.md → Deployment Checklist

**Finding a Specific File:**
1. Check: CRITICAL_PATHS.md → Organized by category
2. Or: CRITICAL_PATHS.md → File Path by Feature

## Key Statistics

| Metric | Value |
|--------|-------|
| Source Files | 260+ |
| Components | 45+ |
| Screens | 15 |
| Contexts | 13 |
| Custom Hooks | 39 |
| Services | 20+ |
| Test Files | 30+ |
| Estimated LOC | 50,000+ |
| Dependencies | 50+ |
| Bitcoin Libraries | 5 |

## Technology Stack Summary

- **React**: 19.1.0 (Latest)
- **React Native**: 0.81.5 (Latest)
- **Expo**: 54.0.20 (Latest)
- **Bitcoin**: bitcoinjs-lib 7.0.0
- **HD Wallet**: bip32 5.0.0, bip39 3.1.0
- **Runes**: @magiceden-oss/runestone-lib 1.0.2
- **Security**: expo-secure-store, react-native-passkey
- **Crypto**: react-native-quick-crypto, @bitcoinerlab/secp256k1
- **Error Tracking**: @sentry/react-native
- **Testing**: Jest, React Native Testing Library

## Security Highlights

- **Mnemonic Storage**: Cleared from memory after 100ms (withMnemonic pattern)
- **PIN Authentication**: PBKDF2 (10k iterations), 30-min lockout after 10 failures
- **Passkey/WebAuthn**: AES-256-GCM encrypted backup to iCloud
- **Biometric**: Face ID/Touch ID with PIN fallback
- **Address Validation**: Testnet-only (prevents mainnet addresses)
- **Input Validation**: Dust limits, fee limits, amount validation
- **Error Tracking**: Sentry with sensitive data filtering

## Bitcoin Features

- **BIP84**: SegWit addresses (m/84'/1'/0'/0/{i}) → tb1q...
- **BIP86**: Taproot addresses (m/86'/1'/0'/0/{i}) → tb1p...
- **Multi-Account**: HD wallet with account switching
- **PSBT Signing**: Full PSBT construction and signing support
- **Runes/UNIT**: Full support for Runes transactions
- **UTXO Selection**: Optimized algorithm with dust filtering
- **Fee Calculation**: sats/vB model with configurable rates
- **Network**: Testnet (Mutinynet/Signet) only

## Critical Files

**Must Review Before Production:**
1. `/services/secureStorageService.js` - Mnemonic storage
2. `/services/pinService.js` - PIN verification (250+ lines)
3. `/services/passkeyService.js` - WebAuthn integration (1,106 lines)
4. `/services/transactionSigningService.js` - PSBT signing
5. `/constants/security.js` - Security configuration
6. `/utils/bitcoin.js` - Address validation
7. `/App.js` - Provider setup
8. `/contexts/AuthContext.js` - Authentication state

## Architecture Overview

```
Provider Hierarchy:
  App
  ├── AuthProvider (authentication state)
  ├── WalletProvider (wallet addresses)
  └── UIProvider (toast notifications)
      └── AppProviders (nested)
          ├── PendingTransactionsProvider
          ├── WalletDataProvider
          └── PriceProvider
              └── AppNavigator
                  └── RootNavigator
                      ├── AuthStack (Welcome → PinSetup → Lock)
                      └── MainTabs (Wallet, Send, Settings, Vault)
```

## Document Versions

- **Analysis Date**: 2025-11-17
- **Codebase Snapshot**: Main branch (clean state)
- **React Native Version**: 0.81.5
- **Expo Version**: 54.0.20
- **Analysis Depth**: Comprehensive (all major files examined)
- **Completeness**: 260+ files analyzed

## Updating These Documents

When updating the codebase:
1. Keep CRITICAL_PATHS.md in sync with new files
2. Update CODEBASE_SUMMARY.md for breaking changes
3. For major refactors, update CODEBASE_ANALYSIS.md sections
4. Update statistics if adding/removing major components

## How to Use These Documents

1. **For Code Review**: Start with CODEBASE_ANALYSIS.md → Section 6 (Security)
2. **For Bug Fixes**: Use CRITICAL_PATHS.md to find related files
3. **For New Features**: Read CODEBASE_SUMMARY.md → Common Tasks
4. **For Understanding Flow**: See CODEBASE_ANALYSIS.md → Section 8 (Data Flows)
5. **For Deployment**: Check CODEBASE_ANALYSIS.md → Section 11

## Related Documentation

- `ARCHITECTURE_STANDARDS.md` - Architecture guidelines and standards
- `README.md` - Project setup and running instructions
- `package.json` - Dependencies and scripts

## Quick Command Reference

```bash
# Start development
npm start

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Lint and format
npm run lint
npm run lint:fix
npm run format

# Build
npm run android
npm run ios
npm run web
```

## Support & Resources

- Bitcoin Docs: https://github.com/bitcoin/bips (BIP39, BIP84, BIP86)
- bitcoinjs-lib: https://github.com/bitcoinjs/bitcoinjs-lib
- Testnet Explorer: https://testnet.bitcoinexplorer.org
- Mutinynet: https://mutinynet.com/api
- Runes: https://docs.ordinals.com/runes

---

**Created**: 2025-11-17  
**Status**: Complete and Production-Ready  
**Maintainer**: Lucas Rodriguez

These documents provide comprehensive reference material for developing, reviewing, and deploying the DUCAT Bitcoin wallet application to production testnet.
