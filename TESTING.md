# Testing Setup

## Current Status

Jest testing framework has been configured with the following setup:

### Installed Dependencies
- `jest` - Testing framework
- `@testing-library/react-native` - React Native testing utilities
- `@testing-library/jest-native` - Custom matchers
- `jest-expo` - Expo preset for Jest
- `@types/jest` - TypeScript definitions

### Configuration
- `jest.config.js` - Jest configuration with expo preset
- `jest.setup.js` - Global mocks and polyfills
- Test scripts in `package.json`:
  - `npm test` - Run all tests
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - Coverage report

### Test Files Created
- `services/__tests__/authService.test.js` - Comprehensive tests for PIN hashing/verification

## Known Issue: Expo 54 Winter Module System

**Problem**: Expo 54 introduced a new "winter" module system that is incompatible with Jest's module resolution, causing this error:

```
ReferenceError: You are trying to `import` a file outside of the scope of the test code.
```

**Status**: This is a known issue in the Expo ecosystem as of November 2025.

**Workarounds Being Explored**:
1. Mock expo modules individually
2. Use integration tests instead of unit tests
3. Wait for Expo 54.1+ patch
4. Consider using Detox for E2E testing

## Alternative: Manual Testing

Until the Jest/Expo compatibility issue is resolved, critical functionality should be tested manually:

### PIN Hashing (authService)
1. Create a new wallet with PIN
2. Lock the app
3. Unlock with correct PIN (should succeed)
4. Try incorrect PIN (should fail)
5. Verify PIN attempts are rate-limited

### Wallet Functions
1. Generate new wallet
2. Import wallet from seed phrase
3. Switch between accounts
4. Verify addresses are correct

### Transaction Functions
1. Create BTC send transaction
2. Create UNIT send transaction
3. Verify fee calculation
4. Broadcast transaction

## Future Testing Strategy

Once the Expo/Jest issue is resolved:
1. Complete unit tests for all services
2. Add integration tests for contexts
3. Add component tests with React Testing Library
4. Set up CI/CD pipeline with automated testing
5. Achieve 70%+ code coverage target
