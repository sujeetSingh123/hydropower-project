import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import env from './env';
import logger from '../utils/logger';

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

pool.on('error', (err: Error) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

const db = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => pool.query<T>(text, params),

  getClient: (): Promise<PoolClient> => pool.connect(),

  transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
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

  healthCheck: async (): Promise<{ now: Date; version: string }> => {
    const result = await pool.query<{ now: Date; version: string }>(
      'SELECT NOW() as now, version() as version'
    );
    return result.rows[0];
  },
};

export default db;
