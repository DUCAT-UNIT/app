// Mock for expo-local-authentication
export const hasHardwareAsync = async () => true;
export const isEnrolledAsync = async () => true;
export const supportedAuthenticationTypesAsync = async () => [1, 2];
export const authenticateAsync = async () => ({ success: true, error: null });
export const cancelAuthenticate = async () => {};
export const getEnrolledLevelAsync = async () => 2;

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

export const SecurityLevel = {
  NONE: 0,
  SECRET: 1,
  BIOMETRIC: 2,
};

export default {
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
  authenticateAsync,
  cancelAuthenticate,
  getEnrolledLevelAsync,
  AuthenticationType,
  SecurityLevel,
};
