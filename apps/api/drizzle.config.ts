import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const isLocalDb =
  databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

let resolvedUrl = databaseUrl;
if (!isLocalDb) {
  resolvedUrl = databaseUrl.includes('?')
    ? `${databaseUrl}&sslmode=no-verify`
    : `${databaseUrl}?sslmode=no-verify`;
}

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolvedUrl,
  },
} satisfies Config;
