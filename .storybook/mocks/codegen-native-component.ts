// Mock for react-native/Libraries/Utilities/codegenNativeComponent
// This is used by native modules that aren't compatible with web

import { View } from 'react-native';

function codegenNativeComponent<T>(name: string, _options?: any): React.ComponentType<T> {
  // Return a simple View component as a placeholder for native components
  return View as any;
}

export default codegenNativeComponent;
