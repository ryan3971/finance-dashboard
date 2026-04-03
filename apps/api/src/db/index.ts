import * as schema from './schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { config } from '@/lib/config';
import { Pool } from 'pg';

// db is initialized lazily so DATABASE_URL is read after dotenv.config() runs,
// not at module import time (static imports are hoisted before dotenv loads).
let _db: NodePgDatabase<typeof schema> | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    const pool = new Pool({ connectionString: config.databaseUrl });
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
