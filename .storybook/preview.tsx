import React from 'react';
import type { Preview } from '@storybook/react-vite';
import { View, StyleSheet } from 'react-native';

const DARK_BG = '#111015';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: DARK_BG,
  },
});

const preview: Preview = {
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: DARK_BG },
        { name: 'light', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ['Foundation', 'Primitives', 'Patterns', 'Components', 'Screens'],
      },
    },
  },
};

export default preview;
