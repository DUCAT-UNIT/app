// Mock for expo-clipboard
export const setStringAsync = async (_content: string) => true;
export const getStringAsync = async () => '';
export const hasStringAsync = async () => false;
export const setString = (_content: string) => {};
export const getString = () => '';

export default { setStringAsync, getStringAsync, hasStringAsync, setString, getString };
