// Mock for expo-application
export const applicationId = 'com.ducat.wallet';
export const applicationName = 'Ducat';
export const nativeApplicationVersion = '1.0.0';
export const nativeBuildVersion = '1';
export const androidId = '';

export const getInstallationTimeAsync = async () => new Date();
export const getLastUpdateTimeAsync = async () => new Date();
export const getInstallReferrerAsync = async () => null;
export const getIosIdForVendorAsync = async () => 'mock-vendor-id';
export const getIosPushNotificationServiceEnvironmentAsync = async () => 'development';

export default {
  applicationId,
  applicationName,
  nativeApplicationVersion,
  nativeBuildVersion,
  androidId,
  getInstallationTimeAsync,
  getLastUpdateTimeAsync,
  getInstallReferrerAsync,
  getIosIdForVendorAsync,
  getIosPushNotificationServiceEnvironmentAsync,
};
