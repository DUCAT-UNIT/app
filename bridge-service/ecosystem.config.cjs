module.exports = {
  apps: [
    {
      name: 'unit-bridge-sepolia',
      cwd: __dirname,
      script: 'dist/bridge-service/src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '8788',
      },
    },
  ],
};
