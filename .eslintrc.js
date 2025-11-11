module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    ecmaFeatures: {
      jsx: true,
    },
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
  },
  plugins: ['react', 'react-native'],
  rules: {
    // Security: Prevent console logs in production
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Code quality
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-undef': 'off', // Turn off for React Native globals (Buffer, BigInt)
    'no-dupe-keys': 'error',
    'radix': 'warn',
    'no-bitwise': 'off', // Allow for Bitcoin crypto operations
    'no-shadow': 'warn',

    // React Native specific
    'react-native/no-inline-styles': 'warn',
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'off',
    'react-native/no-raw-text': 'off',

    // React
    'react/prop-types': 'off', // We'll add TypeScript later
    'react-hooks/exhaustive-deps': 'warn',
    'react/jsx-no-duplicate-props': 'warn',

    // ESLint comments
    'eslint-comments/no-unused-disable': 'warn',
  },
  env: {
    'react-native/react-native': true,
    node: true,
    es6: true,
  },
  globals: {
    Buffer: 'readonly',
    BigInt: 'readonly',
  },
};
