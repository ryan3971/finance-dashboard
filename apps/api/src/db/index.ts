import * as schema from './schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { config } from '@/lib/config';
import { Pool } from 'pg';

// db is initialized lazily so DATABASE_URL is read after dotenv.config() runs,
// not at module import time (static imports are hoisted before dotenv loads).
//
// We read process.env.DATABASE_URL directly (not config.databaseUrl) because
// vitest's setup file swaps DATABASE_URL to DATABASE_URL_TEST at runtime, after
// config.ts has already frozen its snapshot of process.env. Reading the env var
// here ensures tests always connect to finance_test, not finance_dev.
let _db: NodePgDatabase<typeof schema> | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL ?? config.databaseUrl;
    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1');
    const pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

// Convenience re-export so call sites can write `db.select(...)` unchanged.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type DB = NodePgDatabase<typeof schema>;

// Transaction type for functions that can run inside or outside a transaction.
// Extracted from the callback signature so callers don't import Drizzle internals.
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
