module.exports = {
  apps: [
    {
      name: "remo-pro",
      script: "npm",
      args: "run start:node",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      shell: true,
    },
  ],
};
