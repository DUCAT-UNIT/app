import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { getDeviceConfig, DeviceConfig, ScreenSize } from '../styles/responsive';

export interface ResponsiveContextValue {
  width: number;
  height: number;
  screenSize: ScreenSize;
  scale: number;
  deviceConfig: DeviceConfig;
}

export const ResponsiveContext = createContext<ResponsiveContextValue | undefined>(undefined);

interface ResponsiveProviderProps {
  children: ReactNode;
}

export const ResponsiveProvider: React.FC<ResponsiveProviderProps> = ({ children }) => {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    const deviceConfig = getDeviceConfig(width);

    return {
      width,
      height,
      screenSize: deviceConfig.size,
      scale: deviceConfig.scale,
      deviceConfig,
    };
  });

  useEffect(() => {
    const handleDimensionChange = ({ window }: { window: ScaledSize }) => {
      const { width, height } = window;
      const deviceConfig = getDeviceConfig(width);

      setDimensions({
        width,
        height,
        screenSize: deviceConfig.size,
        scale: deviceConfig.scale,
        deviceConfig,
      });
    };

    const subscription = Dimensions.addEventListener('change', handleDimensionChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <ResponsiveContext.Provider value={dimensions}>
      {children}
    </ResponsiveContext.Provider>
  );
};
