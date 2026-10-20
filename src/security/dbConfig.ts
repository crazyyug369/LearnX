import { readFileSync } from 'node:fs';
import type { PoolOptions } from 'mysql2/promise';
import { DatabaseConfigurationError } from './errors.js';

// Read at pool creation, after dotenv/runtime configuration has been loaded.
export function buildDatabaseConfig(env: NodeJS.ProcessEnv = process.env): PoolOptions {
  const port = env.MYSQL_PORT ? Number(env.MYSQL_PORT) : 3306;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new DatabaseConfigurationError('MYSQL_PORT must be a valid TCP port');
  }
  if (env.MYSQL_SSL && !['true', 'false'].includes(env.MYSQL_SSL)) {
    throw new DatabaseConfigurationError('MYSQL_SSL must be true or false');
  }
  const caConfigured = Boolean(env.MYSQL_SSL_CA || env.MYSQL_SSL_CA_FILE);
  if (env.MYSQL_SSL === 'false' && caConfigured) {
    throw new DatabaseConfigurationError('A MySQL CA requires TLS to be enabled');
  }
  if (env.MYSQL_SSL_CA && env.MYSQL_SSL_CA_FILE) {
    throw new DatabaseConfigurationError('Specify only one MySQL CA source');
  }

  let ca: string | undefined;
  if (env.MYSQL_SSL_CA_FILE) {
    try {
      ca = readFileSync(env.MYSQL_SSL_CA_FILE, 'utf8');
      if (!ca.trim()) throw new Error('Empty CA');
    } catch {
      throw new DatabaseConfigurationError('Unable to load the MySQL TLS CA');
    }
  } else if (env.MYSQL_SSL_CA) {
    ca = env.MYSQL_SSL_CA.replace(/\\n/g, '\n');
  }

  return {
    host: env.MYSQL_HOST,
    port,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(env.MYSQL_SSL === 'true' || caConfigured ? {
      ssl: { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2', ...(ca ? { ca } : {}) },
    } : {}),
  };
}
