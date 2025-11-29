// Mock for react-native-icloudstore

const mockStore: Record<string, string> = {};

const iCloudStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return mockStore[key] || null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    mockStore[key] = value;
  },
  removeItem: async (key: string): Promise<void> => {
    delete mockStore[key];
  },
  getAllKeys: async (): Promise<string[]> => {
    return Object.keys(mockStore);
  },
  clear: async (): Promise<void> => {
    Object.keys(mockStore).forEach(key => delete mockStore[key]);
  },
  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map(key => [key, mockStore[key] || null]);
  },
  multiSet: async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => {
      mockStore[key] = value;
    });
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    keys.forEach(key => delete mockStore[key]);
  },
};

export default iCloudStorage;
