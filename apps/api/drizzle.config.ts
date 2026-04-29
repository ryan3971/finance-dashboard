import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

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
