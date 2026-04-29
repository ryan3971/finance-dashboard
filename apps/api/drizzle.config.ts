/* eslint-disable no-console */
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '../../.env');
console.log(`[drizzle] loading env from: ${envPath}`);
const { error: dotenvError } = dotenv.config({ path: envPath });
if (dotenvError) {
  console.warn(`[drizzle] dotenv warning: ${dotenvError.message}`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

// Log host and database only — never log credentials.
try {
  const { host, pathname } = new URL(databaseUrl);
  console.log(`[drizzle] connecting to host=${host} db=${pathname.slice(1)}`);
} catch {
  console.log('[drizzle] DATABASE_URL is set (could not parse for logging)');
}

const urlWithSsl = databaseUrl.includes('?')
  ? `${databaseUrl}&sslmode=no-verify`
  : `${databaseUrl}?sslmode=no-verify`;

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: urlWithSsl,
  },
} satisfies Config;
