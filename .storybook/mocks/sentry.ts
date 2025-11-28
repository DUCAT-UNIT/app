// Mock for @sentry/react-native
export const init = () => {};
export const captureException = () => {};
export const captureMessage = () => {};
export const setUser = () => {};
export const setTag = () => {};
export const setContext = () => {};
export const addBreadcrumb = () => {};
export const withScope = (callback: (scope: unknown) => void) => callback({});
export default { init, captureException, captureMessage, setUser, setTag, setContext, addBreadcrumb, withScope };
