// Global type declarations for React Native

declare global {
  // React Native development flag
  var __DEV__: boolean;

  namespace NodeJS {
    interface Global {
      __DEV__: boolean;
    }
  }
}

export {};
