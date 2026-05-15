const path = require('path');

const projectDir = process.env.LOGIT_PROJECT_DIR || path.resolve(__dirname, '../..');

module.exports = {
  apps: [
    {
      name: 'logit-backend',
      cwd: path.join(projectDir, 'logic-arena-backend'),
      script: 'src/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
