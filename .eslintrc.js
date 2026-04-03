module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  parser: '@babel/eslint-parser',
  ignorePatterns: ['coverage/**', 'node_modules/**'],
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
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ['@typescript-eslint'],
      extends: [
        '@react-native',
        'plugin:@typescript-eslint/recommended',
        'prettier',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_.*|e|err|error|.*Error)$',
          ignoreRestSiblings: true,
        }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-shadow': 'warn',
        'no-shadow': 'off', // Turn off base rule as it conflicts with TS version
        'no-undef': 'off', // TypeScript handles this
        'no-bitwise': 'off',
        'react-native/no-inline-styles': 'off',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'no-var': 'off',
        '@typescript-eslint/no-unsafe-function-type': 'off',
      },
    },
    {
      files: ['styles/**/*'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
  rules: {
    // Security: Prevent console logs in production (strict enforcement after console.log removal)
    'no-console': ['error', { allow: ['warn', 'error'] }],

    // Code quality
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^(_.*|e|err|error|.*Error)$',
      ignoreRestSiblings: true,
    }],
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-undef': 'off', // Turn off for React Native globals (Buffer, BigInt)
    'no-dupe-keys': 'error',
    'radix': 'warn',
    'no-bitwise': 'off', // Allow for Bitcoin crypto operations
    'no-shadow': 'warn',

    // React Native specific
    'react-native/no-inline-styles': 'off',
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'off',
    'react-native/no-raw-text': 'off',

    // React
    'react/prop-types': 'off', // We'll add TypeScript later
    'react-hooks/exhaustive-deps': 'warn',
    'react/jsx-no-duplicate-props': 'warn',
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
