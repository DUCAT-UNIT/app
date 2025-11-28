// Mock for expo-device
export const brand = 'Web';
export const manufacturer = 'Browser';
export const modelName = 'Browser';
export const modelId = 'browser';
export const designName = null;
export const productName = 'browser';
export const deviceYearClass = 2024;
export const totalMemory = 8000000000;
export const supportedCpuArchitectures = ['x86_64'];
export const osName = 'Web';
export const osVersion = '1.0';
export const osBuildId = null;
export const osInternalBuildId = null;
export const osBuildFingerprint = null;
export const platformApiLevel = null;
export const deviceName = 'Browser';
export const deviceType = 3; // DESKTOP
export const isDevice = false;

export const DeviceType = {
  UNKNOWN: 0,
  PHONE: 1,
  TABLET: 2,
  DESKTOP: 3,
  TV: 4,
};

export const getDeviceTypeAsync = async () => DeviceType.DESKTOP;
export const getUptimeAsync = async () => 0;
export const getMaxMemoryAsync = async () => 8000000000;
export const isRootedExperimentalAsync = async () => false;
export const isSideLoadingEnabledAsync = async () => false;
export const getPlatformFeaturesAsync = async () => [];
export const hasPlatformFeatureAsync = async () => false;

export default {
  brand,
  manufacturer,
  modelName,
  modelId,
  designName,
  productName,
  deviceYearClass,
  totalMemory,
  supportedCpuArchitectures,
  osName,
  osVersion,
  osBuildId,
  osInternalBuildId,
  osBuildFingerprint,
  platformApiLevel,
  deviceName,
  deviceType,
  isDevice,
  DeviceType,
  getDeviceTypeAsync,
  getUptimeAsync,
  getMaxMemoryAsync,
  isRootedExperimentalAsync,
  isSideLoadingEnabledAsync,
  getPlatformFeaturesAsync,
  hasPlatformFeatureAsync,
};
