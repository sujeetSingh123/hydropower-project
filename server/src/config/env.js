require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    name: process.env.POSTGRES_DB || 'hydropower',
    user: process.env.POSTGRES_USER || 'hydro_user',
    password: process.env.POSTGRES_PASSWORD || 'hydro_secret_2024',
    poolMin: 2,
    poolMax: 20,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  scada: {
    opcUaEndpoint: process.env.OPC_UA_ENDPOINT || 'opc.tcp://localhost:4840',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS, 10) || 10000,
    simulatorMode: process.env.SCADA_SIMULATOR === 'true',
    reconnectDelayMs: 5000,
    maxRetries: 10,
  },

  notifications: {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || '',
    },
    whatsapp: {
      apiUrl: process.env.WHATSAPP_API_URL || '',
      apiKey: process.env.WHATSAPP_API_KEY || '',
    },
    twilio: {
      sid: process.env.TWILIO_SID || '',
      token: process.env.TWILIO_TOKEN || '',
      from: process.env.TWILIO_FROM || '',
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
};

module.exports = env;
