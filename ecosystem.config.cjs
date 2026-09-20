module.exports = {
  apps: [
    {
      name: 'keelek-backend',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'Asia/Bangkok'
      }
    }
    // อนาคตสามารถเพิ่มระบบอื่นๆ ต่อท้ายที่นี่ได้ เช่น:
    // {
    //   name: 'system1-backend',
    //   cwd: '../system1/backend',
    //   script: 'src/server.js',
    //   env: { NODE_ENV: 'production', PORT: 3001 }
    // }
  ]
};
