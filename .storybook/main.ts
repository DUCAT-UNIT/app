import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: [
    '../storybook/stories/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',
  // Disable react-docgen as it conflicts with expo's babel preset
  typescript: {
    reactDocgen: false,
  },
  viteFinal: async (config) => {
    const mockPath = (name: string) => path.resolve(__dirname, `mocks/${name}.ts`);

    // Add react-native-web alias
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': 'react-native-web',
      // Mock native code that react-native-web doesn't support
      'react-native/Libraries/Utilities/codegenNativeComponent': mockPath('codegen-native-component'),
      // Mock RN-only packages
      'react-native-safe-area-context': mockPath('safe-area-context'),
      'react-native-icloudstore': mockPath('icloudstore'),
      '@sentry/react-native': mockPath('sentry'),
      'react-native-svg': mockPath('svg'),
      'react-native-reanimated': mockPath('reanimated'),
      'react-native-gesture-handler': mockPath('gesture-handler'),
      '@gorhom/bottom-sheet': mockPath('bottom-sheet'),
      'react-native-qrcode-svg': mockPath('qrcode-svg'),
      'react-native-confetti-cannon': mockPath('confetti'),
      // Mock expo packages
      'expo-modules-core': mockPath('expo-modules-core'),
      'expo-haptics': mockPath('expo-haptics'),
      'expo-linear-gradient': mockPath('expo-linear-gradient'),
      'expo-camera': mockPath('expo-camera'),
      'expo-clipboard': mockPath('expo-clipboard'),
      'expo-secure-store': mockPath('expo-secure-store'),
      'expo-local-authentication': mockPath('expo-local-auth'),
      'expo-font': mockPath('expo-font'),
      'expo-status-bar': mockPath('expo-status-bar'),
      'expo-application': mockPath('expo-application'),
      'expo-device': mockPath('expo-device'),
    };

    // Handle extensions
    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.tsx',
      '.ts',
      '.js',
    ];

    // Exclude problematic modules from optimization
    config.optimizeDeps = config.optimizeDeps || {};
    config.optimizeDeps.exclude = [
      ...(config.optimizeDeps.exclude || []),
      '@sentry/react-native',
      'react-native-svg',
      'react-native-reanimated',
      'react-native-gesture-handler',
      'react-native-safe-area-context',
      'react-native-icloudstore',
      '@gorhom/bottom-sheet',
      // Exclude expo packages
      'expo',
      'expo-modules-core',
      'expo-application',
      'expo-device',
      'expo-font',
      'expo-status-bar',
      'expo-haptics',
      'expo-linear-gradient',
      'expo-camera',
      'expo-clipboard',
      'expo-secure-store',
      'expo-local-authentication',
      'expo-crypto',
      'expo-notifications',
    ];

    // Include react-native-web in optimization
    config.optimizeDeps.include = [
      ...(config.optimizeDeps.include || []),
      'react-native-web',
    ];

    config.optimizeDeps.esbuildOptions = {
      ...config.optimizeDeps.esbuildOptions,
      loader: {
        '.js': 'jsx',
      },
    };

    // Define React Native globals for web
    config.define = {
      ...config.define,
      __DEV__: JSON.stringify(true),
      'process.env.NODE_ENV': JSON.stringify('development'),
    };

    return config;
  },
};

export default config;
