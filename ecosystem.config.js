module.exports = {
  apps: [
    {
      script: "./app",
      env: {
        NODE_ENV: "dev",
        DB_PORT: "",
        DB_USER: "",
        DB_PASSWORD: "",
        QN_ACCESSKEY: "",
        QN_SECRETKEY: ""
      },
      env_prod: {
        NODE_ENV: "prod",
        DB_PORT: "",
        DB_USER: "",
        DB_PASSWORD: "",
        QN_ACCESSKEY: "",
        QN_SECRETKEY: ""
      },
    },
  ],
};
