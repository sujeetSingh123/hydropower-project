const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

const pool = new Pool(
  env.database.url
    ? { connectionString: env.database.url, max: env.database.poolMax, idleTimeoutMillis: 30000 }
    : {
        host: env.database.host,
        port: env.database.port,
        database: env.database.name,
        user: env.database.user,
        password: env.database.password,
        max: env.database.poolMax,
        min: env.database.poolMin,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

const db = {
  query: (text, params) => pool.query(text, params),

  getClient: () => pool.connect(),

  transaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  healthCheck: async () => {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    return result.rows[0];
  },
};

module.exports = db;
