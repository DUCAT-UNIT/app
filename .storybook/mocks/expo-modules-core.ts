// Mock for expo-modules-core
export class UnavailabilityError extends Error {
  constructor(moduleName: string, propertyName?: string) {
    super(`${moduleName}${propertyName ? `.${propertyName}` : ''} is not available on web`);
    this.name = 'UnavailabilityError';
  }
}

export const requireNativeModule = () => ({});
export const requireOptionalNativeModule = () => null;
export const NativeModule = {};
export const EventEmitter = class {
  addListener() { return { remove: () => {} }; }
  removeListener() {}
  removeAllListeners() {}
  emit() {}
};
export const Platform = {
  OS: 'web',
  select: <T>(obj: { web?: T; default?: T }) => obj.web ?? obj.default,
};
export const CodedError = class CodedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
};

export default {
  requireNativeModule,
  requireOptionalNativeModule,
  NativeModule,
  EventEmitter,
  Platform,
  UnavailabilityError,
  CodedError,
};
