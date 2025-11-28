const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Files that are direct exports (not in folders)
const directFileExports = [
  'preview-errors',
  'manager-errors',
  'server-errors',
];

// Fix storybook/internal/* resolution for Metro bundler
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle storybook/internal/* imports
  if (moduleName.startsWith('storybook/internal/')) {
    const subpath = moduleName.replace('storybook/internal/', '');
    const baseDir = path.join(__dirname, 'node_modules/storybook/dist');

    // Check if it's a direct file export (not a folder)
    if (directFileExports.includes(subpath)) {
      const filePath = path.join(baseDir, `${subpath}.js`);
      if (fs.existsSync(filePath)) {
        return {
          filePath,
          type: 'sourceFile',
        };
      }
    }

    // Otherwise, it's a folder with index.js
    const folderPath = path.join(baseDir, subpath, 'index.js');
    if (fs.existsSync(folderPath)) {
      return {
        filePath: folderPath,
        type: 'sourceFile',
      };
    }

    // Fallback - try as direct file
    const directPath = path.join(baseDir, `${subpath}.js`);
    if (fs.existsSync(directPath)) {
      return {
        filePath: directPath,
        type: 'sourceFile',
      };
    }
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
